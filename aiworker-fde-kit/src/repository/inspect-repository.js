import { lstat, readlink } from "node:fs/promises";
import path from "node:path";

import { walkRepositoryEntries } from "./file-walker.js";
import { validateMarkdownLinks } from "./markdown-links.js";
import { validateRepositorySchemas } from "./schema-validator.js";
import { inspectRuntimeBundle } from "./runtime-bundle.js";

async function checkRootSkill(root, issue) {
  try {
    const metadata = await lstat(path.join(root, "SKILL.md"));
    if (metadata.isFile()) return [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return [
    issue(
      "BLOCKER",
      "B_SKILL_MISSING",
      "SKILL.md",
      "Required root SKILL.md is missing.",
    ),
  ];
}

async function checkScripts(root, issue) {
  const entries = await walkRepositoryEntries(root, "scripts");
  const issues = [];

  for (const entry of entries) {
    if (entry.type === "symlink") {
      const linkTarget = await readlink(path.join(root, entry.path));
      issues.push(
        issue(
          "BLOCKER",
          "B_SCRIPT_SYMLINK",
          entry.path,
          "Repository scripts must be regular files, not symbolic links.",
          { linkTarget },
        ),
      );
      continue;
    }

    if (entry.type !== "file") {
      issues.push(
        issue(
          "BLOCKER",
          "B_SCRIPT_TYPE",
          entry.path,
          "Repository scripts must be regular files.",
          { actualType: entry.type },
        ),
      );
      continue;
    }

    const metadata = await lstat(path.join(root, entry.path));
    const mode = metadata.mode & 0o777;
    if (mode !== 0o755) {
      issues.push(
        issue(
          "BLOCKER",
          "B_SCRIPT_MODE",
          entry.path,
          "Repository scripts must use mode 0755.",
          { actualMode: mode.toString(8).padStart(4, "0"), expectedMode: "0755" },
        ),
      );
    }
  }

  return issues;
}

export async function inspectRepository(root, dependencies) {
  const { commandResult, issue } = dependencies;
  const findings = [];
  findings.push(...(await checkRootSkill(root, issue)));
  findings.push(...(await checkScripts(root, issue)));
  findings.push(...(await validateRepositorySchemas(root, { issue })));
  findings.push(...(await validateMarkdownLinks(root, { issue })));
  if (await lstat(path.join(root, "scripts/runtime/bundle-manifest.json"))
    .catch((error) => error.code === "ENOENT" ? null : Promise.reject(error))) {
    const runtime = await inspectRuntimeBundle(root);
    findings.push(...runtime.issues.map((finding) => issue(
      "BLOCKER",
      finding.code,
      finding.path,
      finding.message,
    )));
  }
  return commandResult(findings);
}
