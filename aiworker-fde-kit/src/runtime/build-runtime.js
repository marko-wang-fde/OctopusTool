import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import {
  runtimeBundlePaths,
  runtimeSourceHash,
} from "../repository/runtime-bundle.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const outputDirectory = path.join(ROOT, "scripts/runtime");
  await mkdir(outputDirectory, { recursive: true });
  const temporaryBundle = path.join(
    outputDirectory,
    `.aiworker-fde-runtime-${process.pid}.mjs`,
  );
  await build({
    banner: {
      js: [
        'import { createRequire as __runtimeCreateRequire } from "node:module";',
        "const require = __runtimeCreateRequire(import.meta.url);",
        'process.env.AIWORKER_BUNDLED_RUNTIME = "1";',
      ].join("\n"),
    },
    bundle: true,
    entryPoints: [path.join(ROOT, "src/runtime/runtime-dispatch.js")],
    format: "esm",
    logLevel: "silent",
    outfile: temporaryBundle,
    platform: "node",
    target: "node20",
  });
  const bundleBytes = await readFile(temporaryBundle);
  const source = await runtimeSourceHash(ROOT);
  const manifest = {
    schema_version: 1,
    bundle_path: runtimeBundlePaths.bundle,
    bundle_sha256: createHash("sha256").update(bundleBytes).digest("hex"),
    source_sha256: source.sha256,
    inputs: source.inputs,
  };
  const temporaryManifest = path.join(
    outputDirectory,
    `.bundle-manifest-${process.pid}.json`,
  );
  await writeFile(
    temporaryManifest,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o755 },
  );
  await chmod(temporaryBundle, 0o755);
  await rename(
    temporaryBundle,
    path.join(ROOT, runtimeBundlePaths.bundle),
  );
  await rename(
    temporaryManifest,
    path.join(ROOT, runtimeBundlePaths.manifest),
  );
}

await main();
