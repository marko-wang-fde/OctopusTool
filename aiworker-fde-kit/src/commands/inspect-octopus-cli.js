import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CliInspectionError,
  inspectOctopusCli,
} from "../assembly/cli-inspector.js";
import { commandResult, issue } from "../shared/result.js";

const MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const DEFAULT_CATALOG = path.join(
  MODULE_ROOT,
  "catalog/assembly-operations.yaml",
);
const USAGE =
  "Usage: inspect-octopus-cli " +
  "[--fixture-dir <absolute-dir> | --cli-path <absolute-binary>] " +
  "[--output <absolute-dir>]";
const VALUE_FLAGS = new Map([
  ["--fixture-dir", "fixtureDir"],
  ["--cli-path", "cliPath"],
  ["--output", "output"],
]);

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function argumentFailure(code, message) {
  return withExit(
    2,
    [issue("BLOCKER", code, ".", message)],
    { usage: USAGE },
  );
}

function parseArguments(args, cwd) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.includes("--help")) {
    return {
      error: argumentFailure(
        "B_ARGUMENT_CONFLICT",
        "--help cannot be combined with other arguments.",
      ),
    };
  }
  const parsed = {};
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!VALUE_FLAGS.has(flag)) {
      return {
        error: argumentFailure(
          "B_ARGUMENT_UNKNOWN",
          `Unknown argument: ${flag}`,
        ),
      };
    }
    if (seen.has(flag)) {
      return {
        error: argumentFailure(
          "B_ARGUMENT_CONFLICT",
          `Argument may only be specified once: ${flag}`,
        ),
      };
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return {
        error: argumentFailure(
          "B_ARGUMENT_MISSING",
          `${flag} requires a value.`,
        ),
      };
    }
    if (!path.isAbsolute(value)) {
      return {
        error: argumentFailure(
          "B_ARGUMENT_INVALID",
          `${flag} requires an absolute path.`,
        ),
      };
    }
    seen.add(flag);
    parsed[VALUE_FLAGS.get(flag)] = value;
    index += 1;
  }
  if (parsed.fixtureDir && parsed.cliPath) {
    return {
      error: argumentFailure(
        "B_ARGUMENT_CONFLICT",
        "--fixture-dir and --cli-path are mutually exclusive.",
      ),
    };
  }
  parsed.output ??= path.join(cwd, "generated");
  return parsed;
}

function publicError(error) {
  if (error instanceof CliInspectionError) {
    return withExit(
      error.exitCode,
      [issue("BLOCKER", error.code, ".", error.message, {
        error: error.data?.error,
        recovery_paths: error.data?.recovery_paths ?? [],
        foreign_paths: error.data?.foreign_paths ?? [],
      })],
      error.data,
    );
  }
  return withExit(
    3,
    [issue(
      "BLOCKER",
      "B_CLI_INSPECTION_RUNTIME",
      ".",
      "CLI inspection failed unexpectedly.",
      { error: error instanceof Error ? error.message : String(error) },
    )],
  );
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const cwd = options.cwd ?? process.cwd();
  const parsed = parseArguments(args, cwd);
  let result;
  try {
    if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else if (parsed.error) {
      result = parsed.error;
    } else {
      result = await inspectOctopusCli({
        fixtureDir: parsed.fixtureDir,
        cliPath: parsed.cliPath,
        output: parsed.output,
        catalogPath: options.catalogPath ?? DEFAULT_CATALOG,
        spawnCommand: options.spawnCommand ?? options.spawn,
        transactionHooks: options.transactionHooks,
      });
    }
  } catch (error) {
    result = publicError(error);
  }
  writeStdout(`${JSON.stringify(result)}\n`);
  return result.exitCode;
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;
if (
  process.env.AIWORKER_BUNDLED_RUNTIME !== "1" &&
  invokedPath === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
