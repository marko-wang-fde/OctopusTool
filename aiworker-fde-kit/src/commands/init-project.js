import path from "node:path";
import { pathToFileURL } from "node:url";

import { initializeProject, resumeProject } from "../project/initialize.js";
import { commandResult, issue } from "../shared/result.js";

const USAGE =
  "Usage: init-project --mode new|materials --customer <name> " +
  "--scenario <text> --parent <absolute-dir> [--source <path>...] " +
  "[--source-mode copy|reference] [--name <display-name>] " +
  "[--slug <ascii-slug>] [--confirm] | init-project --mode resume " +
  "--project <absolute-existing-dir> [--confirm-import <proposal-sha256>] " +
  "[--confirm-migration <preview-sha256>]";
const VALUE_FLAGS = new Map([
  ["--mode", "mode"],
  ["--customer", "customer"],
  ["--scenario", "scenario"],
  ["--parent", "parent"],
  ["--source", "sources"],
  ["--source-mode", "sourceMode"],
  ["--name", "name"],
  ["--slug", "slug"],
  ["--project", "project"],
  ["--confirm-import", "confirmImport"],
  ["--confirm-migration", "confirmMigration"],
]);
const BOOLEAN_FLAGS = new Map([["--confirm", "confirm"]]);

function resultWithExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function argumentFailure(code, message) {
  return resultWithExit(
    2,
    [issue("BLOCKER", code, ".", message)],
    { usage: USAGE },
  );
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.includes("--help")) {
    return {
      error: argumentFailure(
        "B_ARGUMENT_CONFLICT",
        "--help cannot be combined with other arguments.",
      ),
    };
  }

  const options = { sources: [] };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (BOOLEAN_FLAGS.has(flag)) {
      if (seen.has(flag)) {
        return {
          error: argumentFailure(
            "B_ARGUMENT_CONFLICT",
            `Argument may only be specified once: ${flag}`,
          ),
        };
      }
      seen.add(flag);
      options[BOOLEAN_FLAGS.get(flag)] = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) {
      return {
        error: argumentFailure(
          "B_ARGUMENT_UNKNOWN",
          `Unknown argument: ${flag}`,
        ),
      };
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return {
        error: argumentFailure(
          "B_ARGUMENT_MISSING",
          `Argument requires a value: ${flag}`,
        ),
      };
    }
    index += 1;
    const key = VALUE_FLAGS.get(flag);
    if (key === "sources") {
      options.sources.push(value);
    } else {
      if (seen.has(flag)) {
        return {
          error: argumentFailure(
            "B_ARGUMENT_CONFLICT",
            `Argument may only be specified once: ${flag}`,
          ),
        };
      }
      seen.add(flag);
      options[key] = value;
    }
  }
  return { options };
}

function missing(options, keys) {
  return keys.filter(
    (key) =>
      typeof options[key] !== "string" || options[key].trim().length === 0,
  );
}

function validateModeArguments(options) {
  if (!["new", "materials", "resume"].includes(options.mode)) {
    return argumentFailure(
      options.mode === undefined ? "B_ARGUMENT_MISSING" : "B_ARGUMENT_INVALID",
      "--mode must be new, materials, or resume.",
    );
  }

  if (options.mode === "resume") {
    const forbidden = [
      "customer",
      "scenario",
      "parent",
      "sourceMode",
      "name",
      "slug",
      "confirm",
    ].filter((key) => options[key] !== undefined);
    if (options.sources.length > 0) forbidden.push("sources");
    if (forbidden.length > 0) {
      return argumentFailure(
        "B_ARGUMENT_CONFLICT",
        `Resume mode forbids project creation arguments: ${forbidden.join(", ")}`,
      );
    }
    if (missing(options, ["project"]).length > 0) {
      return argumentFailure(
        "B_ARGUMENT_MISSING",
        "Resume mode requires --project.",
      );
    }
    if (!path.isAbsolute(options.project)) {
      return argumentFailure(
        "B_ARGUMENT_INVALID",
        "--project must be absolute.",
      );
    }
    if (
      options.confirmImport !== undefined &&
      options.confirmMigration !== undefined
    ) {
      return argumentFailure(
        "B_ARGUMENT_CONFLICT",
        "--confirm-import and --confirm-migration are mutually exclusive.",
      );
    }
    for (const [key, flag] of [
      ["confirmImport", "--confirm-import"],
      ["confirmMigration", "--confirm-migration"],
    ]) {
      if (
        options[key] !== undefined &&
        !/^[a-f0-9]{64}$/u.test(options[key])
      ) {
        return argumentFailure(
          "B_ARGUMENT_INVALID",
          `${flag} must be a lowercase 64-character SHA-256 value.`,
        );
      }
    }
    return null;
  }

  const forbidden = ["project", "confirmImport", "confirmMigration"].filter(
    (key) => options[key] !== undefined,
  );
  if (forbidden.length > 0) {
    return argumentFailure(
      "B_ARGUMENT_CONFLICT",
      `Creation mode forbids resume arguments: ${forbidden.join(", ")}`,
    );
  }
  const missingCreation = missing(options, ["customer", "scenario", "parent"]);
  if (missingCreation.length > 0) {
    return argumentFailure(
      "B_ARGUMENT_MISSING",
      `Missing required arguments: ${missingCreation.join(", ")}`,
    );
  }
  if (!path.isAbsolute(options.parent)) {
    return argumentFailure(
      "B_ARGUMENT_INVALID",
      "--parent must be absolute.",
    );
  }
  if (
    options.sourceMode !== undefined &&
    !["copy", "reference"].includes(options.sourceMode)
  ) {
    return argumentFailure(
      "B_ARGUMENT_INVALID",
      "--source-mode must be copy or reference.",
    );
  }
  if (options.mode === "materials" && options.sources.length === 0) {
    return argumentFailure(
      "B_ARGUMENT_MISSING",
      "Materials mode requires at least one --source.",
    );
  }
  return null;
}

function runtimeFailure(error) {
  return resultWithExit(3, [
    issue(
      "BLOCKER",
      "B_RUNTIME_ERROR",
      ".",
      "init-project failed at runtime.",
      { error: error instanceof Error ? error.message : String(error) },
    ),
  ]);
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  let result;
  try {
    const parsed = parseArguments(args);
    if (parsed.error) {
      result = parsed.error;
    } else if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else {
      const invalid = validateModeArguments(parsed.options);
      if (invalid) {
        result = invalid;
      } else {
        const injectedDependencies = {
          clock: options.clock,
          fs: options.fs,
          hashBytes: options.hashBytes,
          link: options.link,
          rename: options.rename,
          templateRoot: options.templateRoot,
          validateProject: options.validateProject,
        };
        result =
          parsed.options.mode === "resume"
            ? await (options.resumeProject ?? resumeProject)(
                parsed.options,
                injectedDependencies,
              )
            : await (options.initializeProject ?? initializeProject)(
                parsed.options,
                injectedDependencies,
              );
      }
    }
  } catch (error) {
    result = runtimeFailure(error);
  }

  writeStdout(`${JSON.stringify(result)}\n`);
  return result.exitCode;
}

if (
  process.env.AIWORKER_BUNDLED_RUNTIME !== "1" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  process.exitCode = await main(process.argv.slice(2));
}
