import path from "node:path";

import {
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";
import { isExactUtcIsoTimestamp } from "../shared/time.js";

function classification(relativePath) {
  if (/\.(?:json|ya?ml)$/u.test(relativePath)) return "structured-contract";
  if (relativePath.endsWith(".md")) return "documentation";
  if (relativePath.endsWith(".sh")) return "assembly-shell";
  return "delivery-artifact";
}

function mode(relativePath) {
  return relativePath === "assembly/octopus-cli-assemble.sh"
    ? "0755"
    : "0644";
}

function safePath(relativePath) {
  return (
    typeof relativePath === "string" &&
    relativePath.length > 0 &&
    relativePath !== "package-manifest.json" &&
    !path.posix.isAbsolute(relativePath) &&
    !path.win32.isAbsolute(relativePath) &&
    !relativePath.includes("\\") &&
    !relativePath.includes("\0") &&
    !relativePath.split("/").some((part) => part === "." || part === "..")
  );
}

export function isValidPackageManifest(manifest) {
  return (
    manifest !== null &&
    typeof manifest === "object" &&
    !Array.isArray(manifest) &&
    Object.keys(manifest).sort().join(",") ===
      "files,package_input_hash,packaged_at,project_slug,schema_version," +
      "selection_version,self_entry,sources_included" &&
    manifest.schema_version === 1 &&
    manifest.selection_version === 1 &&
    manifest.self_entry === "excluded" &&
    typeof manifest.sources_included === "boolean" &&
    typeof manifest.project_slug === "string" &&
    manifest.project_slug.length > 0 &&
    typeof manifest.package_input_hash === "string" &&
    /^[a-f0-9]{64}$/u.test(manifest.package_input_hash) &&
    isExactUtcIsoTimestamp(manifest.packaged_at) &&
    Array.isArray(manifest.files) &&
    manifest.files.length > 0 &&
    manifest.files.every((entry) =>
      entry !== null &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      Object.keys(entry).sort().join(",") ===
        "classification,mode,path,sha256,type" &&
      typeof entry.path === "string" &&
      entry.type === "file" &&
      /^(?:0644|0755)$/u.test(entry.mode) &&
      typeof entry.sha256 === "string" &&
      /^[a-f0-9]{64}$/u.test(entry.sha256) &&
      typeof entry.classification === "string" &&
      entry.classification.length > 0)
  );
}

export function createPackageManifest(files, options) {
  const paths = sortRelativePaths(
    [...files.keys()].filter((relativePath) =>
      relativePath !== "package-manifest.json"),
  );
  return {
    schema_version: 1,
    selection_version: 1,
    project_slug: options.projectSlug,
    package_input_hash: options.packageInputHash,
    packaged_at: options.packagedAt,
    self_entry: "excluded",
    sources_included: options.sourcesIncluded === true,
    files: paths.map((relativePath) => ({
      path: relativePath,
      type: "file",
      mode: mode(relativePath),
      sha256: sha256Bytes(files.get(relativePath)),
      classification: classification(relativePath),
    })),
  };
}

export function verifyPackageManifest(manifest, files) {
  const issues = [];
  const entries = manifest?.files;
  if (!isValidPackageManifest(manifest)) {
    return commandResult([issue(
      "BLOCKER",
      "B_PACKAGE_MANIFEST_STRUCTURE",
      "package-manifest.json",
      "Package manifest structure is invalid.",
    )]);
  }
  const expectedPaths = sortRelativePaths(
    [...files.keys()].filter((relativePath) =>
      relativePath !== "package-manifest.json"),
  );
  const seen = new Set();
  const folded = new Set();
  for (const [index, entry] of entries.entries()) {
    const entryPath = entry?.path;
    const casePath = typeof entryPath === "string"
      ? entryPath.toLocaleLowerCase("en-US")
      : "";
    const expectedBytes = files.get(entryPath);
    if (
      !safePath(entryPath) ||
      seen.has(entryPath) ||
      folded.has(casePath) ||
      entryPath !== expectedPaths[index] ||
      entry?.type !== "file" ||
      entry?.mode !== mode(entryPath) ||
      entry?.classification !== classification(entryPath) ||
      !expectedBytes ||
      entry?.sha256 !== sha256Bytes(expectedBytes)
    ) {
      issues.push(issue(
        "BLOCKER",
        "B_PACKAGE_MANIFEST_ENTRY",
        `package-manifest.json.files[${index}]`,
        "Manifest entry is unsafe, duplicated, unsorted, or inconsistent.",
      ));
    }
    seen.add(entryPath);
    folded.add(casePath);
  }
  if (
    entries.length !== expectedPaths.length ||
    expectedPaths.some((relativePath) => !seen.has(relativePath))
  ) {
    issues.push(issue(
      "BLOCKER",
      "B_PACKAGE_MANIFEST_COVERAGE",
      "package-manifest.json",
      "Manifest must cover every supplied package file except itself.",
    ));
  }
  return commandResult(issues);
}
