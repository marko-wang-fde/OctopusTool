import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";

import { walkRepositoryEntries } from "./file-walker.js";

function visit(node, visitor) {
  visitor(node);
  for (const child of node.children ?? []) visit(child, visitor);
}

function markdownTargets(contents) {
  const tree = fromMarkdown(contents);
  const definitions = new Map();
  const targets = [];

  visit(tree, (node) => {
    if (node.type === "definition" && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
  });
  visit(tree, (node) => {
    if (node.type === "link" || node.type === "image") targets.push(node.url);
    if (node.type === "linkReference" || node.type === "imageReference") {
      const target = definitions.get(node.identifier);
      if (target !== undefined) targets.push(target);
    }
  });

  return targets;
}

function localTarget(rawTarget) {
  const target = rawTarget.trim();
  if (
    target === "" ||
    target.startsWith("#") ||
    target.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  ) {
    return null;
  }

  const pathOnly = target.split(/[?#]/, 1)[0];
  try {
    return decodeURIComponent(pathOnly);
  } catch {
    return pathOnly;
  }
}

function isInside(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === "" ||
    (!path.isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`))
  );
}

function linkIssue(issue, code, markdownPath, message, target, reason) {
  return issue("BLOCKER", code, markdownPath, message, { target, reason });
}

async function validateTarget(
  root,
  canonicalRoot,
  markdownPath,
  target,
  issue,
) {
  const lexicalTarget = path.resolve(root, path.dirname(markdownPath), target);
  if (!isInside(path.resolve(root), lexicalTarget)) {
    return linkIssue(
      issue,
      "B_LINK_OUTSIDE_ROOT",
      markdownPath,
      "Markdown relative link escapes the repository.",
      target,
      "lexical-escape",
    );
  }

  let canonicalTarget;
  try {
    canonicalTarget = await realpath(lexicalTarget);
  } catch (error) {
    if (["ELOOP", "ENOENT", "ENOTDIR"].includes(error.code)) {
      return linkIssue(
        issue,
        "B_LINK_BROKEN",
        markdownPath,
        "Markdown relative link target does not exist.",
        target,
        "missing-or-dangling",
      );
    }
    throw error;
  }

  if (!isInside(canonicalRoot, canonicalTarget)) {
    return linkIssue(
      issue,
      "B_LINK_OUTSIDE_ROOT",
      markdownPath,
      "Markdown relative link resolves outside the repository.",
      target,
      "canonical-escape",
    );
  }

  return null;
}

export async function validateMarkdownLinks(root, { issue }) {
  const markdownEntries = (await walkRepositoryEntries(root)).filter(
    (entry) => entry.type === "file" && entry.path.toLowerCase().endsWith(".md"),
  );
  const canonicalRoot = await realpath(root);
  const issues = [];

  for (const { path: markdownPath } of markdownEntries) {
    const contents = await readFile(path.join(root, markdownPath), "utf8");
    for (const rawTarget of markdownTargets(contents)) {
      const target = localTarget(rawTarget);
      if (target === null) continue;

      const finding = await validateTarget(
        root,
        canonicalRoot,
        markdownPath,
        target,
        issue,
      );
      if (finding !== null) issues.push(finding);
    }
  }

  return issues;
}
