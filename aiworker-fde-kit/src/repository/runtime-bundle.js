import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";

const BUNDLE_PATH = "scripts/runtime/aiworker-fde-runtime.mjs";
const MANIFEST_PATH = "scripts/runtime/bundle-manifest.json";

async function exists(pathValue) {
  try {
    return await lstat(pathValue);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function walkJavaScript(root, relativeDirectory, paths) {
  const directory = path.join(root, relativeDirectory);
  if (!await exists(directory)) return;
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) =>
    Buffer.compare(Buffer.from(left.name), Buffer.from(right.name))
  );
  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      await walkJavaScript(root, relativePath, paths);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      paths.push(relativePath);
    }
  }
}

export async function runtimeInputPaths(root) {
  const paths = ["package-lock.json", "package.json"];
  await walkJavaScript(root, "src", paths);
  const scriptsDirectory = path.join(root, "scripts");
  if (await exists(scriptsDirectory)) {
    const scripts = await readdir(scriptsDirectory, { withFileTypes: true });
    for (const entry of scripts) {
      if (entry.isFile()) paths.push(`scripts/${entry.name}`);
    }
  }
  return paths.sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right))
  );
}

export async function runtimeSourceHash(root) {
  const hash = createHash("sha256");
  const inputs = await runtimeInputPaths(root);
  for (const relativePath of inputs) {
    hash.update(relativePath, "utf8");
    hash.update("\0");
    hash.update(await readFile(path.join(root, relativePath)));
    hash.update("\n");
  }
  return { inputs, sha256: hash.digest("hex") };
}

export async function inspectRuntimeBundle(root) {
  const manifestFile = path.join(root, MANIFEST_PATH);
  const bundleFile = path.join(root, BUNDLE_PATH);
  const issues = [];
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch (error) {
    return {
      valid: false,
      issues: [{
        code: "B_RUNTIME_BUNDLE_MISSING",
        path: MANIFEST_PATH,
        message: `Runtime bundle manifest is unavailable: ${error.message}`,
      }],
    };
  }
  let bundleHash;
  try {
    bundleHash = createHash("sha256")
      .update(await readFile(bundleFile))
      .digest("hex");
  } catch (error) {
    issues.push({
      code: "B_RUNTIME_BUNDLE_MISSING",
      path: BUNDLE_PATH,
      message: `Runtime bundle is unavailable: ${error.message}`,
    });
  }
  if (bundleHash && bundleHash !== manifest.bundle_sha256) {
    issues.push({
      code: "B_RUNTIME_BUNDLE_HASH",
      path: BUNDLE_PATH,
      message: "Runtime bundle bytes do not match its signed manifest.",
    });
  }
  if (await exists(path.join(root, "src"))) {
    const source = await runtimeSourceHash(root);
    if (
      source.sha256 !== manifest.source_sha256 ||
      JSON.stringify(source.inputs) !== JSON.stringify(manifest.inputs)
    ) {
      issues.push({
        code: "B_RUNTIME_BUNDLE_STALE",
        path: MANIFEST_PATH,
        message: "Runtime inputs changed; rebuild the runtime bundle.",
      });
    }
  }
  return { valid: issues.length === 0, issues };
}

export const runtimeBundlePaths = {
  bundle: BUNDLE_PATH,
  manifest: MANIFEST_PATH,
};
