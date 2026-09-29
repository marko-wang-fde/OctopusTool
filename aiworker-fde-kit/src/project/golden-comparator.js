import {
  lstat,
  open,
  readdir,
  readFile,
} from "node:fs/promises";
import { constants as fileConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadOperationCatalog } from "../assembly/operation-catalog.js";
import { renderDryrunScript } from "../assembly/dryrun-renderer.js";
import { inspectRenderedDryrunScript } from "../assembly/shell-safety.js";
import { parseSafeJson, parseSafeYaml } from "../contracts/safe-data.js";
import {
  canonicalBytes,
  normalizeMarkdown,
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import { issue } from "../shared/result.js";

const KINDS = new Set(["json", "yaml", "markdown", "shell"]);
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const ASSEMBLY_CATALOG_PATH = path.join(
  ROOT,
  "catalog/assembly-operations.yaml",
);
const SHA256 = /^[a-f0-9]{64}$/u;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const KIND_SUFFIXES = {
  json: [".json"],
  yaml: [".yaml", ".yml"],
  markdown: [".md"],
  shell: [".sh"],
};
const ENTRY_KEYS = {
  json: new Set(["path", "kind", "sha256"]),
  yaml: new Set(["path", "kind", "sha256"]),
  markdown: new Set([
    "path",
    "kind",
    "sha256",
    "required_literals",
    "forbidden_literals",
  ]),
  shell: new Set([
    "path",
    "kind",
    "sha256",
    "mode",
    "required_literals",
    "forbidden_literals",
    "assemble_call_count",
  ]),
};

function failure(code, artifactPath, message, details = {}) {
  return issue("BLOCKER", code, artifactPath, message, details);
}

function normalizedPath(value) {
  if (
    typeof value === "string" &&
    /[\u0000-\u001f\u007f-\u009f]/u.test(value)
  ) {
    throw new Error(`${JSON.stringify(value)}: control characters are not allowed.`);
  }
  return sortRelativePaths([value])[0];
}

function assertExpectedDocument(expected) {
  if (
    !expected ||
    typeof expected !== "object" ||
    Array.isArray(expected) ||
    expected.schema_version !== 1 ||
    !Array.isArray(expected.files) ||
    Object.keys(expected).sort().join(",") !== "files,schema_version"
  ) {
    throw new Error(
      "Expected artifacts must contain only schema_version and files.",
    );
  }
  const normalized = expected.files.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.path !== "string" ||
      !KINDS.has(entry.kind)
    ) {
      throw new Error("Each expected artifact requires a safe path and kind.");
    }
    const artifactPath = normalizedPath(entry.path);
    if (!KIND_SUFFIXES[entry.kind].some((suffix) =>
      artifactPath.endsWith(suffix))) {
      throw new Error(
        `${artifactPath}: kind does not match the artifact extension.`,
      );
    }
    const unknownKeys = Object.keys(entry).filter((key) =>
      !ENTRY_KEYS[entry.kind].has(key));
    if (unknownKeys.length > 0) {
      throw new Error(
        `${artifactPath}: unknown expectation fields: ${unknownKeys.join(", ")}.`,
      );
    }
    if (["json", "yaml", "shell"].includes(entry.kind)) {
      if (typeof entry.sha256 !== "string" || !SHA256.test(entry.sha256)) {
        throw new Error(`${artifactPath}: a SHA-256 digest is required.`);
      }
    } else if (entry.sha256 !== null) {
      throw new Error(`${artifactPath}: Markdown sha256 must be null.`);
    }
    if (["markdown", "shell"].includes(entry.kind)) {
      if (
        !Array.isArray(entry.required_literals) ||
        !entry.required_literals.every((value) =>
          typeof value === "string" && value.length > 0) ||
        new Set(entry.required_literals).size !==
          entry.required_literals.length ||
        !Array.isArray(entry.forbidden_literals) ||
        !entry.forbidden_literals.every((value) =>
          typeof value === "string" && value.length > 0) ||
        new Set(entry.forbidden_literals).size !==
          entry.forbidden_literals.length
      ) {
        throw new Error(`${artifactPath}: literal assertions must be string lists.`);
      }
    }
    if (
      entry.kind === "shell" &&
      (entry.mode !== "0755" ||
        !Number.isInteger(entry.assemble_call_count) ||
        entry.assemble_call_count < 1)
    ) {
      throw new Error(`${artifactPath}: shell mode and call count are required.`);
    }
    return { ...entry, path: artifactPath };
  });
  sortRelativePaths(normalized.map(({ path: artifactPath }) => artifactPath));
  return normalized;
}

export async function loadExpectedArtifacts(expectedPath) {
  const expected = parseSafeYaml(
    await readFile(expectedPath, "utf8"),
    expectedPath,
  );
  assertExpectedDocument(expected);
  return expected;
}

export function hashStructuredArtifact(bytes, artifactPath) {
  const text = UTF8.decode(bytes);
  const value = artifactPath.endsWith(".json")
    ? parseSafeJson(text, artifactPath)
    : parseSafeYaml(text, artifactPath);
  return sha256Bytes(canonicalBytes(value));
}

async function snapshotRegularFile(absolutePath) {
  const before = await lstat(absolutePath);
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`Golden project entry is not a regular file: ${absolutePath}`);
  }
  const handle = await open(
    absolutePath,
    fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    const bytes = await handle.readFile();
    const after = await lstat(absolutePath);
    if (
      before.dev !== opened.dev ||
      before.ino !== opened.ino ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      after.isSymbolicLink() ||
      !after.isFile()
    ) {
      throw new Error(`Golden project entry changed during read: ${absolutePath}`);
    }
    return { bytes, mode: after.mode & 0o777 };
  } finally {
    await handle.close();
  }
}

async function walkProject(projectRoot) {
  const root = await lstat(projectRoot);
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new Error("Golden project root must be a non-symbolic directory.");
  }
  const files = new Map();
  const directories = [""];
  while (directories.length > 0) {
    const relativeDirectory = directories.pop();
    const absoluteDirectory = relativeDirectory
      ? path.join(projectRoot, ...relativeDirectory.split("/"))
      : projectRoot;
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const rawRelativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        throw new Error(
          `Golden project contains a symbolic link: ${rawRelativePath}`,
        );
      }
      if (metadata.isDirectory()) directories.push(rawRelativePath);
      else if (metadata.isFile()) {
        const relativePath = normalizedPath(rawRelativePath);
        if (files.has(relativePath)) {
          throw new Error(
            `Golden project path collision after normalization: ${relativePath}`,
          );
        }
        files.set(relativePath, await snapshotRegularFile(absolutePath));
      } else {
        throw new Error(
          `Golden project contains an unsafe entry: ${rawRelativePath}`,
        );
      }
    }
  }
  return files;
}

function compareLiterals(text, entry, issues) {
  let cursor = 0;
  for (const literal of entry.required_literals) {
    const found = text.indexOf(literal, cursor);
    if (found === -1) {
      const existsEarlier = text.includes(literal);
      issues.push(failure(
        existsEarlier ? "B_GOLDEN_LITERAL_ORDER" : "B_GOLDEN_LITERAL_MISSING",
        entry.path,
        existsEarlier
          ? "Required Markdown literals are not in the declared order."
          : "A required literal is missing.",
        { literal },
      ));
      break;
    }
    cursor = found + literal.length;
  }
  for (const literal of entry.forbidden_literals) {
    if (text.includes(literal)) {
      issues.push(failure(
        "B_GOLDEN_FORBIDDEN_LITERAL",
        entry.path,
        "A forbidden literal is present.",
        { literal },
      ));
    }
  }
}

function followsStrictShellLineGrammar(text) {
  const allowedOctopusLines = new Set([
    'command octopus-cli "$@"',
    "printf '%s\\n' 'refusing empty octopus-cli invocation' >&2",
    "printf '%s\\n' 'generated call starts with an option instead of an octopus-cli command path' >&2",
    "printf '%s\\n' 'generated call is not routed through run_octopus_assemble' >&2",
  ]);
  const forbiddenExecutors = new Set([
    "env",
    "eval",
    "source",
    "xargs",
  ]);
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#!")) continue;
    const words = trimmed.split(/[ \t]+/u);
    const executable = words[0];
    if (
      forbiddenExecutors.has(executable) ||
      executable === "." ||
      (executable === "bash" && words[1] === "-c") ||
      (executable === "command" &&
        trimmed !== 'command octopus-cli "$@"') ||
      (trimmed.includes("octopus-cli") &&
        !allowedOctopusLines.has(trimmed))
    ) {
      return false;
    }
  }
  return true;
}

async function expectedGeneratedShell(actual, entry) {
  if (entry.path !== "assembly/octopus-cli-assemble.sh") return null;
  const operationsSnapshot = actual.get("assembly/operations.yaml");
  if (!operationsSnapshot) {
    throw new Error("Golden assembly rendering requires assembly/operations.yaml.");
  }
  const plan = parseSafeYaml(
    UTF8.decode(operationsSnapshot.bytes),
    "assembly/operations.yaml",
  );
  const operations = (plan.operations ?? []).filter((operation) =>
    operation.support === "supported" &&
    operation.operation_kind === "write");
  if (operations.length !== entry.assemble_call_count) {
    throw new Error("Golden assembly operation count differs from its declaration.");
  }
  const catalog = await loadOperationCatalog(ASSEMBLY_CATALOG_PATH);
  const catalogById = new Map(catalog.supported.map((operation) => [
    operation.operation_id,
    operation,
  ]));
  return renderDryrunScript(operations, catalogById);
}

async function inspectShell(
  snapshot,
  text,
  entry,
  actual,
  issues,
  dependencies,
) {
  let generatedBytes;
  try {
    generatedBytes = await expectedGeneratedShell(actual, entry);
  } catch (error) {
    issues.push(failure(
      "B_GOLDEN_ASSEMBLY_UNSAFE",
      entry.path,
      "Shell artifact could not be derived from the validated renderer contract.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    ));
    return;
  }
  const renderedSafety = generatedBytes
    ? inspectRenderedDryrunScript(snapshot.bytes, generatedBytes, {
      processAdapter: dependencies?.localProcess,
    })
    : { valid: true };
  if (!renderedSafety.valid || !followsStrictShellLineGrammar(text)) {
    issues.push(failure(
      "B_GOLDEN_ASSEMBLY_UNSAFE",
      entry.path,
      "Shell artifact is not the exact generated assembly script.",
      { renderer_code: renderedSafety.code ?? null },
    ));
  }
}

export async function compareGoldenProject({
  projectRoot,
  expected,
  dependencies = {},
}) {
  const entries = assertExpectedDocument(expected);
  const actual = await walkProject(projectRoot);
  const actualPaths = sortRelativePaths([...actual.keys()]);
  const expectedPaths = sortRelativePaths(entries.map(({ path: artifactPath }) =>
    artifactPath));
  const expectedByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const actualSet = new Set(actualPaths);
  const expectedSet = new Set(expectedPaths);
  const issues = [];
  const hashes = {};

  for (const artifactPath of expectedPaths) {
    if (!actualSet.has(artifactPath)) {
      issues.push(failure(
        "B_GOLDEN_FILE_MISSING",
        artifactPath,
        "Expected Golden artifact is missing.",
      ));
    }
  }
  for (const artifactPath of actualPaths) {
    if (!expectedSet.has(artifactPath)) {
      issues.push(failure(
        "B_GOLDEN_FILE_UNEXPECTED",
        artifactPath,
        "Golden project contains an undeclared artifact.",
      ));
    }
  }

  for (const artifactPath of expectedPaths) {
    const snapshot = actual.get(artifactPath);
    if (!snapshot) continue;
    const entry = expectedByPath.get(artifactPath);
    if (entry.kind === "json" || entry.kind === "yaml") {
      let actualHash;
      try {
        actualHash = hashStructuredArtifact(snapshot.bytes, artifactPath);
      } catch (error) {
        issues.push(failure(
          "B_GOLDEN_PARSE",
          artifactPath,
          "Structured Golden artifact is not safe, valid JSON data.",
          { error: error instanceof Error ? error.message : String(error) },
        ));
        continue;
      }
      hashes[artifactPath] = actualHash;
      if (actualHash !== entry.sha256) {
        issues.push(failure(
          "B_GOLDEN_HASH_MISMATCH",
          artifactPath,
          "Canonical structured artifact hash differs from the Golden digest.",
          { expected: entry.sha256, actual: actualHash },
        ));
      }
      continue;
    }
    let rawText;
    try {
      rawText = UTF8.decode(snapshot.bytes);
    } catch (error) {
      issues.push(failure(
        "B_GOLDEN_UTF8",
        artifactPath,
        "Text Golden artifact is not valid UTF-8.",
        { error: error instanceof Error ? error.message : String(error) },
      ));
      continue;
    }
    const text = normalizeMarkdown(rawText);
    compareLiterals(text, entry, issues);
    if (entry.kind === "markdown") continue;

    if (rawText.includes("\r") || !rawText.endsWith("\n")) {
      issues.push(failure(
        "B_GOLDEN_SHELL_FORMAT",
        artifactPath,
        "Shell artifact must be UTF-8 text with LF endings and a final LF.",
      ));
    }
    const actualHash = sha256Bytes(snapshot.bytes);
    hashes[artifactPath] = actualHash;
    if (actualHash !== entry.sha256) {
      issues.push(failure(
        "B_GOLDEN_HASH_MISMATCH",
        artifactPath,
        "Shell artifact byte hash differs from the Golden digest.",
        { expected: entry.sha256, actual: actualHash },
      ));
    }
    if (snapshot.mode !== 0o755) {
      issues.push(failure(
        "B_GOLDEN_MODE_MISMATCH",
        artifactPath,
        "Shell artifact mode must be 0755.",
        { expected: "0755", actual: snapshot.mode.toString(8).padStart(4, "0") },
      ));
    }
    await inspectShell(
      snapshot,
      text,
      entry,
      actual,
      issues,
      dependencies,
    );
  }

  return {
    issues,
    actual_paths: actualPaths,
    expected_paths: expectedPaths,
    hashes,
    matched_files: expectedPaths.filter((artifactPath) =>
      actual.get(artifactPath) !== undefined &&
      !issues.some((item) => item.path === artifactPath)).length,
  };
}
