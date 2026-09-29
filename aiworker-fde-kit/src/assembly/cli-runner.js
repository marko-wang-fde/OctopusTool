import { spawn } from "node:child_process";

import { parseSafeJson } from "../contracts/safe-data.js";
import { assertCommandPath } from "./operation-catalog.js";

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const BODY_PROBE_JSON = "{\"__aiworker_fde_cli_body_probe__\":true}";
const SAFE_PROBE_ARGUMENT = /^[A-Za-z0-9_.:-]+$/u;

function appendChunk(chunks, chunk, size) {
  const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  const nextSize = size + bytes.length;
  if (nextSize > MAX_OUTPUT_BYTES) {
    const error = new Error("CLI probe output exceeded the safe byte limit.");
    error.code = "E_CLI_OUTPUT_LIMIT";
    throw error;
  }
  chunks.push(bytes);
  return nextSize;
}

export function spawnCommand(command, args, options = {}) {
  if (typeof command !== "string" || !Array.isArray(args)) {
    throw new TypeError("CLI probes require a command and argv array.");
  }
  if (args.some((argument) => typeof argument !== "string")) {
    throw new TypeError("Every CLI probe argv item must be a string.");
  }
  if (options.shell !== false) {
    throw new Error("CLI probes require shell: false.");
  }
  if (
    options.cwd !== undefined &&
    (
      typeof options.cwd !== "string" ||
      !options.cwd.startsWith("/")
    )
  ) {
    throw new Error("CLI probes require an absolute cwd when provided.");
  }

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        shell: false,
        ...(options.cwd ? { cwd: options.cwd } : {}),
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      reject(error);
      return;
    }
    const stdout = [];
    const stderr = [];
    let stdoutSize = 0;
    let stderrSize = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(error);
    };
    child.once("error", fail);
    child.stdout.on("data", (chunk) => {
      try {
        stdoutSize = appendChunk(stdout, chunk, stdoutSize);
      } catch (error) {
        fail(error);
      }
    });
    child.stderr.on("data", (chunk) => {
      try {
        stderrSize = appendChunk(stderr, chunk, stderrSize);
      } catch (error) {
        fail(error);
      }
    });
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      resolve({
        exitCode: exitCode ?? 3,
        signal: signal ?? null,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
  });
}

function ensureProbeSuccess(result, label) {
  if (result.exitCode === 0) return result;
  const error = new Error(`${label} exited with code ${result.exitCode}.`);
  error.code = "E_CLI_PROBE_EXIT";
  error.probe = label;
  error.exitCode = result.exitCode;
  throw error;
}

function inspectNpmPackageProbe(result) {
  let parsed;
  try {
    parsed = parseSafeJson(
      result.stdout.toString("utf8"),
      "npm list --global @syngy/octopus-cli",
    );
  } catch (error) {
    error.code = "E_NPM_PROBE_MALFORMED";
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("npm package probe did not return a JSON object.");
    error.code = "E_NPM_PROBE_MALFORMED";
    throw error;
  }
  const packageMissing =
    parsed.dependencies?.["@syngy/octopus-cli"] === undefined;
  if (result.exitCode === 0) return { packageMissing };
  if (result.exitCode === 1 && packageMissing) return { packageMissing: true };
  return null;
}

function assertProbeArgument(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("-") ||
    value.includes("\u0000") ||
    !SAFE_PROBE_ARGUMENT.test(value)
  ) {
    const error = new Error(`${label} is not a safe probe argument.`);
    error.code = "E_OPERATION_CATALOG_INVALID";
    throw error;
  }
  return value;
}

function normalizeBodyProbeSpec(spec, index) {
  if (Array.isArray(spec)) {
    return {
      commandPath: assertCommandPath(spec, `bodyProbeCommandPaths[${index}]`),
      positionalValues: [],
    };
  }
  if (!spec || typeof spec !== "object") {
    const error = new Error("Body probe specs must be command paths or objects.");
    error.code = "E_OPERATION_CATALOG_INVALID";
    throw error;
  }
  const commandPath = assertCommandPath(
    spec.commandPath,
    `bodyProbeCommandPaths[${index}].commandPath`,
  );
  const positionalValues = (spec.positionalValues ?? []).map((value, valueIndex) =>
    assertProbeArgument(
      value,
      `bodyProbeCommandPaths[${index}].positionalValues[${valueIndex}]`,
    ));
  return { commandPath, positionalValues };
}

export async function runCliProbes({
  cliPath,
  commandPaths,
  bodyProbeCommandPaths = [],
  spawnCommand: execute = spawnCommand,
  selectCommandPaths = (_helpBytes, paths) => paths,
}) {
  if (!Array.isArray(commandPaths)) {
    assertCommandPath(commandPaths, "commandPaths");
  }
  const validatedCommandPaths = commandPaths.map((commandPath, index) =>
    assertCommandPath(commandPath, `commandPaths[${index}]`));
  const validatedBodyProbeSpecs = bodyProbeCommandPaths.map((spec, index) =>
    normalizeBodyProbeSpec(spec, index));
  const acquired = {
    npmPackageVersion: null,
    npmPackageMissing: false,
    cliVersion: null,
    helpJson: null,
    leafHelp: [],
    bodyProbes: [],
  };
  const run = async (command, args, label) => {
    let result;
    try {
      result = await execute(command, [...args], {
        shell: false,
        argv: [...args],
      });
      if (label === "npm-package-version") {
        acquired.npmPackageVersion = result;
        const npmProbe = inspectNpmPackageProbe(result);
        if (npmProbe) {
          acquired.npmPackageMissing = npmProbe.packageMissing;
          return result;
        }
      } else if (label === "cli-version") {
        acquired.cliVersion = result;
      } else if (label === "help-json") {
        acquired.helpJson = result;
      } else if (label.startsWith("leaf-help/")) {
        acquired.leafHelp.push({
          commandPath: args.slice(0, -1),
          ...result,
        });
      }
      return ensureProbeSuccess(result, label);
    } catch (error) {
      error.diagnostics = acquired;
      error.probe = error.probe ?? label;
      throw error;
    }
  };

  await run(
    "npm",
    ["list", "--global", "@syngy/octopus-cli", "--json", "--depth=0"],
    "npm-package-version",
  );

  await run(cliPath, ["--version"], "cli-version");

  const helpResult = await run(cliPath, ["--help-json"], "help-json");

  let selectedCommandPaths;
  try {
    selectedCommandPaths = selectCommandPaths(
      helpResult.stdout,
      validatedCommandPaths.map((commandPath) => [...commandPath]),
    );
  } catch (error) {
    error.diagnostics = acquired;
    error.probe = "help-json";
    throw error;
  }
  for (const commandPath of selectedCommandPaths) {
    const validatedPath = assertCommandPath(
      commandPath,
      "selectCommandPaths result",
    );
    await run(
      cliPath,
      [...validatedPath, "--help"],
      `leaf-help/${validatedPath.join("-")}`,
    );
  }
  let selectedBodyProbeCommandPaths;
  try {
    selectedBodyProbeCommandPaths = selectCommandPaths(
      helpResult.stdout,
      validatedBodyProbeSpecs.map(({ commandPath }) => [...commandPath]),
    );
  } catch (error) {
    error.diagnostics = acquired;
    error.probe = "help-json";
    throw error;
  }
  for (const commandPath of selectedBodyProbeCommandPaths) {
    const validatedPath = assertCommandPath(
      commandPath,
      "selectCommandPaths body-probe result",
    );
    const spec = validatedBodyProbeSpecs.find(({ commandPath: pathValue }) =>
      pathValue.join("\u0000") === validatedPath.join("\u0000"));
    const positionalValues = spec?.positionalValues ?? [];
    const result = await run(
      cliPath,
      [
        "--dryrun",
        ...validatedPath,
        ...positionalValues,
        "--body-json",
        BODY_PROBE_JSON,
        "--json",
      ],
      `body-probe/${validatedPath.join("-")}`,
    );
    acquired.bodyProbes.push({
      commandPath: [...validatedPath],
      ...result,
    });
  }
  return acquired;
}
