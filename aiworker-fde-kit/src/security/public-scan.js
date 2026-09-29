import {
  lstat,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

import { spawnCommand } from "../assembly/cli-runner.js";
import { parseSafeYaml } from "../contracts/safe-data.js";
import {
  isRecognizedTextPath,
  publicContentFindingCodes,
  publicFilenameFindingCodes,
} from "./public-content-rules.js";
import { commandResult, issue } from "../shared/result.js";

const MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const DEFAULT_ALLOWLIST = path.join(
  MODULE_ROOT,
  "catalog/public-content-allowlist.yaml",
);
const USAGE = "Usage: scan-public-repository [absolute-repository]";
const decoder = new TextDecoder("utf-8", { fatal: true });

const GOLDEN_ALLOWED_LITERALS = new Set([
  "星河科技",
  "星河科技客户线索收集数字员工",
  "苏州星禾包装有限公司",
  "苏州启明包装",
  "王芳",
  "赵蕾",
  "张楠",
  "13900000002",
  "138 0000 0001",
  "138-0000-0001",
]);

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function parseArguments(args, cwd) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length > 1) {
    return {
      error: withExit(2, [
        issue("BLOCKER", "B_ARGUMENT_UNKNOWN", ".", "Too many arguments."),
      ], { usage: USAGE }),
    };
  }
  const repository = args[0] ?? cwd;
  if (!path.isAbsolute(repository)) {
    return {
      error: withExit(2, [
        issue(
          "BLOCKER",
          "B_ARGUMENT_INVALID",
          ".",
          "Repository path must be absolute.",
        ),
      ], { usage: USAGE }),
    };
  }
  return { repository: path.resolve(repository) };
}

async function defaultListFiles(repository, execute = spawnCommand) {
  const result = await execute(
    "git",
    [
      "-C",
      repository,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ],
    { shell: false, cwd: repository },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `git ls-files failed with exit ${result.exitCode}: ` +
        result.stderr.toString("utf8").slice(0, 512),
    );
  }
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function loadAllowlist(document) {
  const literals = document?.allowed_literals;
  const patterns = document?.allowed_patterns;
  if (
    !document ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    Object.keys(document).sort().join("\0") !==
      ["allowed_literals", "allowed_patterns", "schema_version"].join("\0") ||
    document?.schema_version !== 1 ||
    !Array.isArray(literals) ||
    !Array.isArray(patterns) ||
    patterns.length !== 0 ||
    literals.some((entry) =>
      !entry ||
      Object.keys(entry).sort().join("\0") !== ["paths", "value"].join("\0") ||
      typeof entry.value !== "string" ||
      entry.value.length === 0 ||
      !GOLDEN_ALLOWED_LITERALS.has(entry.value) ||
      !Array.isArray(entry.paths) ||
      entry.paths.length === 0 ||
      entry.paths.some((value) =>
        typeof value !== "string" ||
        value.length === 0 ||
        path.posix.isAbsolute(value) ||
        value.includes("..")
      )
    )
  ) {
    throw new Error("Public content allowlist is malformed.");
  }
  return { literals };
}

function pathMatches(relativePath, pattern) {
  return pattern.endsWith("/**")
    ? relativePath.startsWith(pattern.slice(0, -2))
    : relativePath === pattern;
}

function stripAllowedLiterals(text, allowedLiterals, relativePath) {
  let sanitized = text;
  for (const entry of allowedLiterals) {
    const policyDocument =
      relativePath === "catalog/public-content-allowlist.yaml";
    if (
      !policyDocument &&
      !entry.paths.some((pattern) => pathMatches(relativePath, pattern))
    ) {
      continue;
    }
    sanitized = sanitized.split(entry.value).join("<allowed-test-value>");
  }
  return sanitized;
}

function filenameIssues(relativePath) {
  return publicFilenameFindingCodes(relativePath).map((code) => issue(
    "BLOCKER",
    code,
    relativePath,
    "Credential-shaped filenames must not be published.",
  ));
}

function inspectText(relativePath, bytes, policy) {
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    return [issue(
      "BLOCKER",
      "B_PUBLIC_BINARY_UNKNOWN",
      relativePath,
      "Unknown binary files are not allowed in the public repository.",
    )];
  }
  if (
    !isRecognizedTextPath(relativePath, text) ||
    text.includes("\u0000")
  ) {
    return [issue(
      "BLOCKER",
      "B_PUBLIC_BINARY_UNKNOWN",
      relativePath,
      "File extension or content is not on the public text whitelist.",
    )];
  }
  const inspected = stripAllowedLiterals(
    text,
    policy.literals,
    relativePath,
  );
  return publicContentFindingCodes(inspected).map((code) => issue(
    "BLOCKER",
    code,
    relativePath,
    "Potential private or customer-specific content is not public-safe.",
  ));
}

function validateListedPath(relativePath) {
  return (
    typeof relativePath === "string" &&
    relativePath.length > 0 &&
    !relativePath.includes("\0") &&
    relativePath.split("/").every((segment) =>
      segment !== "" && segment !== "." && segment !== ".."
    ) &&
    !path.posix.isAbsolute(relativePath)
  );
}

export async function scanPublicRepository(repository, options = {}) {
  const allowlistPath = options.allowlistPath ?? DEFAULT_ALLOWLIST;
  const policy = loadAllowlist(parseSafeYaml(
    await readFile(allowlistPath, "utf8"),
    "catalog/public-content-allowlist.yaml",
  ));
  const listFiles = options.listFiles ??
    ((root) => defaultListFiles(root, options.spawnCommand ?? spawnCommand));
  const listed = await listFiles(repository);
  if (!Array.isArray(listed)) {
    throw new Error("Git file listing did not return an array.");
  }
  const relativePaths = [...new Set(listed)].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const findings = [];
  for (const relativePath of relativePaths) {
    if (!validateListedPath(relativePath)) {
      throw new Error("Git returned an unsafe repository path.");
    }
    const absolutePath = path.resolve(repository, ...relativePath.split("/"));
    if (
      absolutePath !== repository &&
      !absolutePath.startsWith(`${repository}${path.sep}`)
    ) {
      throw new Error("Git path escaped the repository.");
    }
    findings.push(...filenameIssues(relativePath));
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      findings.push(issue(
        "BLOCKER",
        "B_PUBLIC_BINARY_UNKNOWN",
        relativePath,
        "Only regular public files may be scanned.",
      ));
      continue;
    }
    findings.push(...inspectText(
      relativePath,
      await readFile(absolutePath),
      policy,
    ));
  }
  return commandResult(findings, {
    clean: findings.length === 0,
    scanned_files: relativePaths.length,
  });
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const parsed = parseArguments(args, options.cwd ?? process.cwd());
  let result;
  try {
    if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else if (parsed.error) {
      result = parsed.error;
    } else {
      result = await scanPublicRepository(parsed.repository, options);
    }
  } catch (error) {
    result = withExit(3, [
      issue(
        "BLOCKER",
        "B_PUBLIC_SCAN_RUNTIME",
        ".",
        "Public repository scan failed unexpectedly.",
        { error: error instanceof Error ? error.message : String(error) },
      ),
    ]);
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

export { USAGE };
