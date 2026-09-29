import path from "node:path";

import { issue } from "../shared/result.js";

const TEXT_SOURCE_EXTENSIONS = new Set([
  ".bash",
  ".c",
  ".cc",
  ".cfg",
  ".conf",
  ".cpp",
  ".csv",
  ".css",
  ".go",
  ".gql",
  ".graphql",
  ".h",
  ".hpp",
  ".htm",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".kts",
  ".log",
  ".md",
  ".mjs",
  ".php",
  ".pl",
  ".properties",
  ".proto",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".rst",
  ".scala",
  ".sh",
  ".sql",
  ".svelte",
  ".svg",
  ".swift",
  ".toml",
  ".ts",
  ".tsv",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);

function unscannable(relativePath, reason) {
  return issue(
    "BLOCKER",
    "B_SOURCE_UNSCANNABLE",
    relativePath,
    "V1 can package only source files that can be scanned as explicit UTF-8 text.",
    { reason },
  );
}

function unscannableDelivery(relativePath, reason) {
  return issue(
    "BLOCKER",
    "B_DELIVERY_FILE_UNSCANNABLE",
    relativePath,
    "Delivery files must use an explicit text format that can be scanned safely.",
    { reason },
  );
}

function hasBinarySignature(bytes) {
  const prefix = bytes.subarray(0, 16);
  return (
    prefix.subarray(0, 5).equals(Buffer.from("%PDF-", "ascii")) ||
    prefix.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    prefix.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
    prefix.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08])) ||
    prefix.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ) ||
    prefix.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    prefix.subarray(0, 6).equals(Buffer.from("GIF87a", "ascii")) ||
    prefix.subarray(0, 6).equals(Buffer.from("GIF89a", "ascii")) ||
    (
      prefix.subarray(0, 4).equals(Buffer.from("RIFF", "ascii")) &&
      bytes.subarray(8, 12).equals(Buffer.from("WEBP", "ascii"))
    ) ||
    prefix.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ||
    prefix.subarray(0, 6).equals(
      Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
    ) ||
    prefix.subarray(0, 4).equals(Buffer.from("Rar!", "ascii")) ||
    prefix.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    )
  );
}

function hasDisallowedControlByte(bytes) {
  return bytes.some((value) =>
    value < 0x20 && value !== 0x09 && value !== 0x0a && value !== 0x0d);
}

function textScanFailure(bytes) {
  if (hasBinarySignature(bytes)) return "binary-signature";
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\0") || hasDisallowedControlByte(bytes)) {
      return "binary-control-byte";
    }
  } catch {
    return "invalid-utf8";
  }
  return null;
}

export function validateSourceScanability(selection, options = {}) {
  if (options.includeSources !== true) return [];
  const issues = [];
  for (const [relativePath, bytes] of selection.files) {
    if (!relativePath.startsWith("inputs/source-files/")) continue;
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (!TEXT_SOURCE_EXTENSIONS.has(extension)) {
      issues.push(unscannable(relativePath, "unsupported-source-format"));
      continue;
    }
    const failure = textScanFailure(bytes);
    if (failure) issues.push(unscannable(relativePath, failure));
  }
  return issues;
}

export function validateDeliveryFileScanability(files) {
  const issues = [];
  for (const [relativePath, bytes] of files) {
    if (relativePath.startsWith("inputs/source-files/")) continue;
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (!TEXT_SOURCE_EXTENSIONS.has(extension)) {
      issues.push(unscannableDelivery(
        relativePath,
        "unsupported-delivery-format",
      ));
      continue;
    }
    const failure = textScanFailure(bytes);
    if (failure) {
      issues.push(unscannableDelivery(relativePath, failure));
    }
  }
  return issues;
}
