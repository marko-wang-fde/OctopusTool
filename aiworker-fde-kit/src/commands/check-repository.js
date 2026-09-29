import path from "node:path";
import { pathToFileURL } from "node:url";

const USAGE = "Usage: check-repository [--help]";

async function loadDependencies() {
  const [repositoryModule, resultModule] = await Promise.all([
    import("../repository/inspect-repository.js"),
    import("../shared/result.js"),
  ]);

  return {
    commandResult: resultModule.commandResult,
    inspectRepository: repositoryModule.inspectRepository,
    issue: resultModule.issue,
  };
}

function resultWithExitCode(commandResult, issues, exitCode, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function runtimeFailureResult(error) {
  return {
    exitCode: 3,
    issues: [
      {
        severity: "BLOCKER",
        code: "B_RUNTIME_ERROR",
        path: ".",
        message: "Repository check failed at runtime.",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    ],
    data: {},
  };
}

export async function main(args, options = {}) {
  const writeStdout = options.writeStdout ?? ((value) => process.stdout.write(value));
  let result;

  try {
    const dependencies = await (options.loadDependencies ?? loadDependencies)();
    const root = options.root ?? process.cwd();
    const inspect =
      options.inspectRepository ?? dependencies.inspectRepository;
    const { commandResult, issue } = dependencies;

    if (args.length === 1 && args[0] === "--help") {
      result = commandResult([], { usage: USAGE });
    } else if (args.length > 0) {
      result = resultWithExitCode(
        commandResult,
        [
          issue(
            "BLOCKER",
            "B_ARGUMENT_INVALID",
            ".",
            `Unknown argument: ${args[0]}`,
          ),
        ],
        2,
        { usage: USAGE },
      );
    } else {
      result = await inspect(root, dependencies);
    }
  } catch (error) {
    result = runtimeFailureResult(error);
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
