import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyInstalledTarget,
  verifyInstallManifest,
} from "../install/discovery-check.js";
import { snapshotSkillTree } from "../install/file-snapshot.js";
import { preflightInstall } from "../install/preflight.js";
import {
  ancestryWarning,
  inspectSourceMetadata,
} from "../install/source-metadata.js";
import {
  inspectRuntimeBundle as inspectRuntimeBundleDefault,
} from "../repository/runtime-bundle.js";
import {
  commitInstallTransaction,
  InstallTransactionError,
  readManifestState,
} from "../install/transaction.js";
import { commandResult, issue } from "../shared/result.js";

const MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const USAGE =
  "Usage: install --target codex|claude-code|both " +
  "[--mode symlink|copy] [--update | --replace]";
const TARGETS = new Set(["codex", "claude-code", "both"]);
const MODES = new Set(["symlink", "copy"]);

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function argumentError(code, message) {
  return {
    error: withExit(
      2,
      [issue("BLOCKER", code, ".", message)],
      { usage: USAGE },
    ),
  };
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.includes("--help")) {
    return argumentError(
      "B_ARGUMENT_CONFLICT",
      "--help cannot be combined with other arguments.",
    );
  }
  const parsed = { mode: "symlink", replace: false, update: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (seen.has(flag)) {
      return argumentError(
        "B_ARGUMENT_CONFLICT",
        `Argument may only be specified once: ${flag}`,
      );
    }
    seen.add(flag);
    if (flag === "--update" || flag === "--replace") {
      parsed[flag.slice(2)] = true;
      continue;
    }
    if (flag !== "--target" && flag !== "--mode") {
      return argumentError("B_ARGUMENT_UNKNOWN", `Unknown argument: ${flag}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return argumentError("B_ARGUMENT_MISSING", `${flag} requires a value.`);
    }
    parsed[flag.slice(2)] = value;
    index += 1;
  }
  if (!parsed.target) {
    return argumentError("B_ARGUMENT_MISSING", "--target is required.");
  }
  if (!TARGETS.has(parsed.target)) {
    return argumentError(
      "B_ARGUMENT_INVALID",
      "--target must be codex, claude-code, or both.",
    );
  }
  if (!MODES.has(parsed.mode)) {
    return argumentError(
      "B_ARGUMENT_INVALID",
      "--mode must be symlink or copy.",
    );
  }
  if (parsed.update && parsed.replace) {
    return argumentError(
      "B_ARGUMENT_CONFLICT",
      "--update and --replace are mutually exclusive.",
    );
  }
  return parsed;
}

function resolveLayout(target, env) {
  if (!env.HOME || !path.isAbsolute(env.HOME)) {
    throw new Error("HOME must be an absolute path.");
  }
  const configHome = env.XDG_CONFIG_HOME || path.join(env.HOME, ".config");
  if (!path.isAbsolute(configHome)) {
    throw new Error("XDG_CONFIG_HOME must be an absolute path.");
  }
  const targets = {
    codex: path.join(
      env.HOME,
      ".agents/skills/design-aiworker-solutions",
    ),
    "claude-code": path.join(
      env.HOME,
      ".claude/skills/design-aiworker-solutions",
    ),
  };
  const ids = target === "both" ? ["codex", "claude-code"] : [target];
  return ids.map((id) => ({
    id,
    path: targets[id],
    manifestPath: path.join(
      configHome,
      `aiworker-fde-kit/installations/${id}.json`,
    ),
  }));
}

async function nearestExistingPath(pathValue) {
  let cursor = path.resolve(pathValue);
  const suffix = [];
  while (true) {
    try {
      await lstat(cursor);
      return path.join(await realpath(cursor), ...suffix);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function canonicalEndpoint(pathValue) {
  const parent = await nearestExistingPath(path.dirname(pathValue));
  return path.join(parent, path.basename(pathValue));
}

function pathsOverlap(left, right) {
  const relative = path.relative(left, right);
  return relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." &&
      !path.isAbsolute(relative));
}

async function pathOverlapIssues(sourcePath, targetSpecs) {
  const endpoints = [
    { kind: "source", path: sourcePath },
  ];
  for (const target of targetSpecs) {
    endpoints.push({
      kind: `target:${target.id}`,
      path: await canonicalEndpoint(target.path),
    });
    endpoints.push({
      kind: `manifest:${target.id}`,
      path: await canonicalEndpoint(target.manifestPath),
    });
  }
  const issues = [];
  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      const first = endpoints[left];
      const second = endpoints[right];
      if (
        pathsOverlap(first.path, second.path) ||
        pathsOverlap(second.path, first.path)
      ) {
        issues.push(issue(
          "BLOCKER",
          "B_INSTALL_PATH_OVERLAP",
          second.path,
          "Install source, targets, and manifests must not overlap.",
          { first, second },
        ));
      }
    }
  }
  return issues;
}

function runtimeResult(error) {
  const recoveryPaths = error instanceof InstallTransactionError
    ? error.recoveryPaths
    : [];
  return withExit(
    3,
    [issue(
      "BLOCKER",
      "B_INSTALL_RUNTIME",
      ".",
      "Skill installation failed unexpectedly.",
      {
        error: error instanceof Error ? error.message : String(error),
        cause: error?.cause instanceof Error ? error.cause.message : undefined,
        recovery_paths: recoveryPaths,
      },
    )],
    { recovery_paths: recoveryPaths },
  );
}

function mergeIssues(...groups) {
  return commandResult(groups.flat()).issues;
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const parsed = parseArguments(args);
  let result;
  try {
    if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else if (parsed.error) {
      result = parsed.error;
    } else {
      const sourcePath = await realpath(options.sourceRoot ?? MODULE_ROOT);
      const targetSpecs = resolveLayout(
        parsed.target,
        options.env ?? process.env,
      );
      const overlapIssues = await pathOverlapIssues(sourcePath, targetSpecs);
      if (overlapIssues.length > 0) {
        result = withExit(1, overlapIssues);
        writeStdout(`${JSON.stringify(result)}\n`);
        return result.exitCode;
      }
      const runtimeInspection = await (
        options.inspectRuntimeBundle ?? inspectRuntimeBundleDefault
      )(sourcePath);
      if (!runtimeInspection.valid) {
        result = withExit(
          1,
          runtimeInspection.issues.map((finding) => issue(
            "BLOCKER",
            finding.code,
            finding.path,
            finding.message,
          )),
        );
        writeStdout(`${JSON.stringify(result)}\n`);
        return result.exitCode;
      }
      const sourceSnapshot = await snapshotSkillTree(sourcePath);
      if (!sourceSnapshot.files["SKILL.md"]) {
        throw new Error("Skill source does not contain SKILL.md.");
      }
      const sourceMetadata = options.sourceMetadata ?? await inspectSourceMetadata(
        sourcePath,
        { runGit: options.runGit },
      );
      for (const targetSpec of targetSpecs) {
        const state = await readManifestState(
          targetSpec.manifestPath,
          targetSpec.id,
        );
        Object.assign(targetSpec, {
          manifest: state.manifest,
          manifestExists: state.exists,
          manifestState: state.state,
          manifestValid: state.valid,
        });
      }
      const invalid = targetSpecs.filter((targetSpec) =>
        targetSpec.manifestExists && !targetSpec.manifestValid
      );
      if (invalid.length > 0 && !parsed.replace) {
        result = withExit(
          1,
          mergeIssues(
            sourceMetadata.issues ?? [],
            invalid.map((targetSpec) => issue(
              "BLOCKER",
              "B_INSTALL_MANIFEST_INVALID",
              targetSpec.manifestPath,
              "The target install manifest is invalid; use --replace.",
            )),
          ),
        );
      } else {
        const preflight = await preflightInstall({
          mode: parsed.mode,
          replace: parsed.replace,
          sourcePath,
          sourceSnapshot,
          targetSpecs,
          update: parsed.update,
        });
        const ancestryIssues = [];
        if (parsed.mode === "copy" && parsed.update) {
          for (const targetSpec of targetSpecs) {
            ancestryIssues.push(...await ancestryWarning({
              previousCommit: targetSpec.manifest?.source_commit,
              sourceCommit: sourceMetadata.source_commit,
              sourcePath,
              runGit: sourceMetadata.runGit ?? options.runGit,
            }));
          }
        }
        const allIssues = mergeIssues(
          sourceMetadata.issues ?? [],
          preflight.issues,
          ancestryIssues,
        );
        if (preflight.exitCode !== 0) {
          result = {
            ...preflight,
            issues: allIssues,
          };
        } else if (preflight.action === "noop") {
          for (const plan of preflight.plans) {
            await verifyInstalledTarget({
              mode: parsed.mode,
              sourcePath,
              sourceSnapshot,
              targetId: plan.id,
              targetPath: plan.path,
            });
            const targetSpec = targetSpecs.find(({ id }) => id === plan.id);
            await verifyInstallManifest({
              allowDiagnosticDrift: parsed.mode === "symlink",
              manifest: targetSpec.manifest,
              manifestPath: targetSpec.manifestPath,
              mode: parsed.mode,
              sourcePath,
              sourceSnapshot,
              targetId: plan.id,
              targetPath: plan.path,
            });
          }
          result = {
            ...commandResult(allIssues, {
              action: "noop",
              source_tree_hash: sourceSnapshot.source_tree_hash,
              targets: targetSpecs.map(({ id, manifestPath, path: targetPath }) =>
                ({ id, manifest_path: manifestPath, path: targetPath })),
            }),
          };
        } else {
          const transaction = await commitInstallTransaction({
            installedAt: (options.clock?.() ?? new Date()).toISOString(),
            mode: parsed.mode,
            plans: preflight.plans,
            sourceMetadata,
            sourcePath,
            sourceSnapshot,
            transactionHooks: options.transactionHooks,
          });
          const cleanupIssues = transaction.recovery_paths.length > 0
            ? [issue(
                "WARNING",
                "W_INSTALL_CLEANUP_DEFERRED",
                ".",
                "Foreign changes were retained in quarantine.",
                { recovery_paths: transaction.recovery_paths },
              )]
            : [];
          result = commandResult(
            mergeIssues(allIssues, cleanupIssues),
            {
              action: preflight.action,
              recovery_paths: transaction.recovery_paths,
              source_tree_hash: sourceSnapshot.source_tree_hash,
              targets: targetSpecs.map(({ id, manifestPath, path: targetPath }) =>
                ({ id, manifest_path: manifestPath, path: targetPath })),
            },
          );
        }
      }
    }
  } catch (error) {
    result = runtimeResult(error);
  }
  writeStdout(`${JSON.stringify(result)}\n`);
  return result.exitCode;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (
  process.env.AIWORKER_BUNDLED_RUNTIME !== "1" &&
  invokedPath === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
