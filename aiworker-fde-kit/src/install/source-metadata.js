import { spawnCommand } from "../assembly/cli-runner.js";
import { issue } from "../shared/result.js";

async function defaultGit(args) {
  const result = await spawnCommand("git", args, { shell: false });
  if (result.exitCode !== 0) {
    const error = new Error(`git exited with code ${result.exitCode}.`);
    error.code = "E_INSTALL_GIT";
    throw error;
  }
  return {
    stderr: result.stderr.toString("utf8"),
    stdout: result.stdout.toString("utf8"),
  };
}

export async function inspectSourceMetadata(sourcePath, options = {}) {
  const runGit = options.runGit ?? defaultGit;
  try {
    const commitResult = await runGit(["-C", sourcePath, "rev-parse", "HEAD"]);
    const commit = commitResult.stdout.trim();
    if (!/^[a-f0-9]{40,64}$/u.test(commit)) throw new Error("Invalid Git SHA.");
    const statusResult = await runGit([
      "-C",
      sourcePath,
      "status",
      "--porcelain",
      "--untracked-files=normal",
    ]);
    const dirty = statusResult.stdout.trim().length > 0;
    return {
      source_commit: commit,
      source_dirty: dirty,
      issues: dirty
        ? [issue(
            "WARNING",
            "W_INSTALL_SOURCE_DIRTY",
            sourcePath,
            "Installing a snapshot with uncommitted source changes.",
          )]
        : [],
      runGit,
    };
  } catch {
    return {
      source_commit: null,
      source_dirty: true,
      issues: [issue(
        "WARNING",
        "W_INSTALL_GIT_UNAVAILABLE",
        sourcePath,
        "Git metadata is unavailable; the current file snapshot is still installable.",
      )],
      runGit,
    };
  }
}

export async function ancestryWarning({
  previousCommit,
  sourceCommit,
  sourcePath,
  runGit,
}) {
  if (!previousCommit || !sourceCommit || previousCommit === sourceCommit) {
    return [];
  }
  try {
    await runGit([
      "-C",
      sourcePath,
      "merge-base",
      "--is-ancestor",
      previousCommit,
      sourceCommit,
    ]);
    return [];
  } catch {
    return [issue(
      "WARNING",
      "W_INSTALL_NON_DESCENDANT",
      sourcePath,
      "The new source commit is not known to descend from the installed commit.",
    )];
  }
}
