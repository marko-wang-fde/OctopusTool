import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import {
  claimFileForReplacement,
  removeIfOwned,
} from "../project/validation-report.js";

const SAFE_TOKEN = /^[a-z0-9][a-z0-9._/-]*$/u;
const SAFE_PAYLOAD =
  /^assembly\/payloads\/[a-z0-9][a-z0-9._/-]*\.json$/u;
const UNSAFE_SHELL = /[\n\r\u0000`$;&|<>(){}[\]*?!~]/u;
const OPERATION_KEYS = new Set([
  "operation_id",
  "description",
  "risk",
  "depends_on",
  "executor",
  "support",
  "operation_kind",
  "command_path",
  "payload_file",
  "payload_schema_uri",
  "output_bindings",
  "positional_bindings",
  "payload_bindings",
]);
const BINDING_NAME = /^[a-z][a-z0-9_]*$/u;
const JSON_KEY = /^[A-Za-z0-9_.:-]+$/u;

function rendererFailure(message) {
  const error = new Error(message);
  error.code = "E_ASSEMBLY_RENDER_UNSAFE";
  throw error;
}

function assertSafeToken(value, label) {
  if (
    typeof value !== "string" ||
    !SAFE_TOKEN.test(value) ||
    UNSAFE_SHELL.test(value) ||
    value.split("/").some((part) => part === "." || part === "..") ||
    value.startsWith("-")
  ) {
    rendererFailure(`${label} is outside the fixed safe-token grammar.`);
  }
  return value;
}

function assertSafeOperationId(value, label = "operation_id") {
  assertSafeToken(value, label);
  return value;
}

function assertSafeBindingName(value, label) {
  if (typeof value !== "string" || !BINDING_NAME.test(value)) {
    rendererFailure(`${label} is outside the fixed binding-name grammar.`);
  }
  return value;
}

function assertJsonPath(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    rendererFailure(`${label} must be a non-empty JSON path array.`);
  }
  return value.map((segment, index) => {
    if (
      typeof segment === "number" &&
      Number.isInteger(segment) &&
      segment >= 0
    ) {
      return segment;
    }
    if (typeof segment === "string" && JSON_KEY.test(segment)) {
      return segment;
    }
    rendererFailure(`${label}[${index}] is outside the fixed JSON-path grammar.`);
  });
}

function assertJsonPathList(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    rendererFailure(`${label} must be a non-empty JSON-path list.`);
  }
  return value.map((pathValue, index) =>
    assertJsonPath(pathValue, `${label}[${index}]`));
}

function operationSlug(value) {
  return assertSafeOperationId(value).replace(/[^a-z0-9]+/giu, "_").toUpperCase();
}

function bindingVariableName(operationId, bindingName) {
  return `AIWORKER_FDE_BINDING_${operationSlug(operationId)}_${assertSafeBindingName(bindingName, "binding").toUpperCase()}`;
}

function outputFileVariable(operationId) {
  return `$AIWORKER_FDE_TMPDIR/outputs/${operationSlug(operationId)}.json`;
}

function assertBindingRef(ref, label) {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
    rendererFailure(`${label} must be a binding reference object.`);
  }
  return {
    from_operation: assertSafeOperationId(ref.from_operation, `${label}.from_operation`),
    binding: assertSafeBindingName(ref.binding, `${label}.binding`),
  };
}

export function posixQuote(value) {
  if (typeof value !== "string" || value.includes("\u0000")) {
    rendererFailure("Only NUL-free string argv values can be quoted.");
  }
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function buildOperationArgv(operation, catalogOperation) {
  if (
    !operation ||
    Object.keys(operation).some((key) => !OPERATION_KEYS.has(key)) ||
    operation.support !== "supported" ||
    operation.operation_kind !== "write"
  ) {
    rendererFailure("Renderer accepts only validated supported-write envelopes.");
  }
  assertSafeToken(operation.operation_id, "operation_id");
  if (
    !Array.isArray(operation.command_path) ||
    operation.command_path.length === 0 ||
    !Array.isArray(catalogOperation?.command_path) ||
    operation.command_path.join("\u0000") !==
      catalogOperation.command_path.join("\u0000")
  ) {
    rendererFailure("Command path must exactly match the operation catalog.");
  }
  const commandPath = operation.command_path.map((token, index) =>
    assertSafeToken(token, `command_path[${index}]`));
  const catalogPositionals = catalogOperation.positional_args ?? [];
  const operationPositionals = operation.positional_bindings ?? [];
  if (catalogPositionals.length !== operationPositionals.length) {
    rendererFailure("Operation positional bindings must match the catalog positional arity.");
  }
  const optionKeys = Object.keys(catalogOperation.options ?? {}).sort().join(",");
  if (
    !["output", "output,payload"].includes(optionKeys) ||
    catalogOperation.options?.output !== "--json" ||
    (
      optionKeys.includes("payload") &&
      catalogOperation.options?.payload !== "--body-file"
    )
  ) {
    rendererFailure("Catalog operation contains undeclared options.");
  }
  if (
    catalogOperation.options?.payload === "--body-file" &&
    (
      typeof operation.payload_file !== "string" ||
      !SAFE_PAYLOAD.test(operation.payload_file) ||
      UNSAFE_SHELL.test(operation.payload_file) ||
      operation.payload_file.split("/").some((part) =>
        part === "." || part === "..")
    )
  ) {
    rendererFailure("Payload path is outside assembly/payloads.");
  }
  if (catalogOperation.options?.payload !== "--body-file" && operation.payload_file !== null) {
    rendererFailure("Bodyless catalog operation must not declare a payload file.");
  }
  return [
    ...commandPath,
    ...operationPositionals.map((binding, index) => {
      assertBindingRef(binding, `positional_bindings[${index}]`);
      return `__binding:${index}`;
    }),
    ...(catalogOperation.options?.payload === "--body-file"
      ? ["--body-file", operation.payload_file]
      : []),
    "--json",
  ];
}

export function operationArgvMap(operations, catalogById) {
  return new Map(operations.map((operation) => [
    operation.operation_id,
    buildOperationArgv(operation, catalogById.get(operation.operation_id)),
  ]));
}

export function renderDryrunScript(operations, catalogById, options = {}) {
  const calls = [];
  for (const operation of operations) {
    const catalogOperation = catalogById.get(operation.operation_id);
    const rawArgv = buildOperationArgv(operation, catalogOperation);
    const outputBindings = operation.output_bindings ?? {};
    const positionalBindings = operation.positional_bindings ?? [];
    const payloadBindings = operation.payload_bindings ?? [];
    if (
      !outputBindings ||
      typeof outputBindings !== "object" ||
      Array.isArray(outputBindings)
    ) {
      rendererFailure("output_bindings must be an object when present.");
    }
    if (!Array.isArray(payloadBindings)) {
      rendererFailure("payload_bindings must be an array when present.");
    }
    let renderedPayload = operation.payload_file;
    if (payloadBindings.length > 0) {
      if (typeof operation.payload_file !== "string") {
        rendererFailure("payload_bindings require a source payload file.");
      }
      const stagedPayload =
        `$AIWORKER_FDE_TMPDIR/payloads/${operationSlug(operation.operation_id)}.json`;
      calls.push(`cp -- ${posixQuote(operation.payload_file)} "${stagedPayload}"`);
      for (const [index, binding] of payloadBindings.entries()) {
        const ref = assertBindingRef(binding, `payload_bindings[${index}]`);
        const targetPath = assertJsonPath(binding.target_path, `payload_bindings[${index}].target_path`);
        calls.push([
          "json_set_string",
          `"${stagedPayload}"`,
          posixQuote(JSON.stringify(targetPath)),
          `"${bindingVariableName(ref.from_operation, ref.binding)}"`,
        ].join(" "));
      }
      renderedPayload = `"${stagedPayload}"`;
    }
    const renderedArgv = rawArgv.map((argument) => {
      if (argument.startsWith("__binding:")) {
        const index = Number(argument.slice("__binding:".length));
        const ref = assertBindingRef(
          positionalBindings[index],
          `positional_bindings[${index}]`,
        );
        return `"$${bindingVariableName(ref.from_operation, ref.binding)}"`;
      }
      if (argument === operation.payload_file && renderedPayload !== operation.payload_file) {
        return renderedPayload;
      }
      return posixQuote(argument);
    }).join(" ");
    const capture = Object.keys(outputBindings).length > 0;
    calls.push(
      capture
        ? `run_octopus_assemble_capture ${posixQuote(operation.operation_id)} ${renderedArgv}`
        : `run_octopus_assemble ${renderedArgv}`,
    );
    for (const [bindingName, paths] of Object.entries(outputBindings)) {
      assertSafeBindingName(bindingName, `output_bindings.${bindingName}`);
      const validatedPaths = assertJsonPathList(paths, `output_bindings.${bindingName}`);
      calls.push(
        `${bindingVariableName(operation.operation_id, bindingName)}=$(json_get_first_string "${outputFileVariable(operation.operation_id)}" ${posixQuote(JSON.stringify(validatedPaths))})`,
      );
    }
  }
  const projectBinding = options.projectRoot === undefined
    ? [
      'SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
      'PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)',
    ]
    : [`PROJECT_ROOT=${posixQuote(options.projectRoot)}`];
  if (
    options.projectRoot !== undefined &&
    !path.isAbsolute(options.projectRoot)
  ) {
    rendererFailure("Explicit project root must be absolute.");
  }
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    ...projectBinding,
    'cd -- "$PROJECT_ROOT"',
    "",
    "run_octopus_assemble() {",
    '  if [[ "${1-}" == "" ]]; then',
    "    printf '%s\\n' 'refusing empty octopus-cli invocation' >&2",
    "    return 1",
    "  fi",
    '  command octopus-cli "$@"',
    "}",
    "",
    "run_octopus_assemble_capture() {",
    "  local operation_id output_file",
    "  operation_id=\"$1\"",
    "  shift",
    "  output_file=\"$AIWORKER_FDE_TMPDIR/outputs/${operation_id//[^A-Za-z0-9_]/_}.json\"",
    '  run_octopus_assemble "$@" | tee "$output_file"',
    "}",
    "",
    "json_get_first_string() {",
    "  node -e 'const fs=require(\"fs\"); const obj=JSON.parse(fs.readFileSync(process.argv[1],\"utf8\")); const paths=JSON.parse(process.argv[2]); for (const p of paths) { let v=obj; for (const k of p) v = v == null ? undefined : v[k]; if (typeof v === \"string\" && v.length > 0) { console.log(v); process.exit(0); } } process.exit(1);' \"$1\" \"$2\"",
    "}",
    "",
    "json_set_string() {",
    "  node -e 'const fs=require(\"fs\"); const file=process.argv[1]; const path=JSON.parse(process.argv[2]); const value=process.argv[3]; const obj=JSON.parse(fs.readFileSync(file,\"utf8\")); let cursor=obj; for (let i=0;i<path.length-1;i+=1) cursor=cursor[path[i]]; cursor[path[path.length-1]]=value; fs.writeFileSync(file, JSON.stringify(obj,null,2)+\"\\n\");' \"$1\" \"$2\" \"$3\"",
    "}",
    "",
    "verify_generated_assemble_calls() {",
    "  local generated_call",
    "  while IFS= read -r generated_call; do",
    "    case \"$generated_call\" in",
    "      \"run_octopus_assemble '--\"*)",
    "        printf '%s\\n' 'generated call starts with an option instead of an octopus-cli command path' >&2",
    "        return 1",
    "        ;;",
    "      \"run_octopus_assemble '\"*) ;;",
    "      *)",
    "        printf '%s\\n' 'generated call is not routed through run_octopus_assemble' >&2",
    "        return 1",
    "        ;;",
    "    esac",
    "  done < <(grep '^run_octopus_assemble ' \"$0\" || true)",
    "}",
    "",
    "verify_generated_assemble_calls",
    "",
    "AIWORKER_FDE_TMPDIR=$(mktemp -d -t aiworker-fde-assemble.XXXXXX)",
    "mkdir -p \"$AIWORKER_FDE_TMPDIR/outputs\" \"$AIWORKER_FDE_TMPDIR/payloads\"",
    "cleanup_aiworker_fde_tmpdir() {",
    "  if [[ -n \"$AIWORKER_FDE_TMPDIR\" && -d \"$AIWORKER_FDE_TMPDIR\" && \"$(basename -- \"$AIWORKER_FDE_TMPDIR\")\" == aiworker-fde-assemble.* ]]; then",
    "    rm -rf -- \"$AIWORKER_FDE_TMPDIR\"",
    "  fi",
    "}",
    "trap cleanup_aiworker_fde_tmpdir EXIT",
    "",
    ...calls,
    "",
  ];
  return Buffer.from(lines.join("\n"), "utf8");
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function ensureDirectoryChain(absoluteDirectory) {
  const missing = [];
  let existing = absoluteDirectory;
  while (true) {
    try {
      const metadata = await lstat(existing);
      if (!metadata.isDirectory()) {
        throw new Error(`Output ancestor is not a directory: ${existing}`);
      }
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      missing.unshift(path.basename(existing));
      existing = parent;
    }
  }
  let current = await realpath(existing);
  for (const segment of missing) {
    current = path.join(current, segment);
    await mkdir(current, { mode: 0o755 });
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Output ancestor is unsafe: ${current}`);
    }
  }
  return current;
}

export async function writeDryrunScriptAtomic(target, bytes, options = {}) {
  if (!path.isAbsolute(target) || !Buffer.isBuffer(bytes)) {
    throw new Error("Assembly script publication requires an absolute target and bytes.");
  }
  const parent = await ensureDirectoryChain(path.dirname(target));
  const canonicalTarget = path.join(parent, path.basename(target));
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const temporary = path.join(parent, `.${path.basename(target)}.${nonce}.tmp`);
  const backup = path.join(parent, `.${path.basename(target)}.${nonce}.bak`);
  const fs = {
    chmod,
    link,
    lstat,
    mkdir,
    open,
    rename,
    rmdir,
    unlink,
    ...options.fs,
  };
  const handle = await open(temporary, "wx", 0o755);
  let temporaryIdentity;
  try {
    await handle.writeFile(bytes);
    await handle.chmod(0o755);
    await handle.sync();
    temporaryIdentity = await handle.stat();
  } finally {
    await handle.close();
  }
  let prior = null;
  try {
    prior = await lstat(canonicalTarget);
    if (prior.isSymbolicLink() || !prior.isFile()) {
      throw new Error("Existing script target is not a regular file.");
    }
    await claimFileForReplacement(
      fs,
      canonicalTarget,
      backup,
      prior,
    );
  } catch (error) {
    if (error?.recoveryPaths) {
      error.recoveryPaths = [
        ...new Set([...error.recoveryPaths, temporary]),
      ];
    }
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await link(temporary, canonicalTarget);
    await chmod(canonicalTarget, 0o755);
    const published = await lstat(canonicalTarget);
    if (
      !sameIdentity(published, temporaryIdentity) ||
      published.isSymbolicLink() ||
      !published.isFile() ||
      (published.mode & 0o777) !== 0o755
    ) {
      const error = new Error(
        "Published script changed before commit verification.",
      );
      error.recoveryPaths = [
        temporary,
        ...(prior ? [backup] : []),
        canonicalTarget,
      ];
      throw error;
    }
  } catch (error) {
    if (prior) {
      try {
        await link(backup, canonicalTarget);
      } catch {
        error.recoveryPaths = [backup, temporary];
      }
    }
    throw error;
  }
  await removeIfOwned(fs, temporary, temporaryIdentity);
  if (prior) await removeIfOwned(fs, backup, prior);
}
