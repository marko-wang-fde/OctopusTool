import { createHash } from "node:crypto";
import path from "node:path";

import { canonicalize } from "json-canonicalize";

import { assertJsonDataModel } from "../contracts/safe-data.js";

class PathSafetyError extends Error {
  constructor(code, pathValue, reason) {
    super(`${pathValue}: ${reason} (${code})`);
    this.name = "PathSafetyError";
    this.code = code;
    this.path = pathValue;
    this.reason = reason;
  }
}

class CanonicalizationError extends Error {
  constructor(code, location, reason) {
    super(`${location}: ${reason} (${code})`);
    this.name = "CanonicalizationError";
    this.code = code;
    this.location = location;
    this.reason = reason;
  }
}

function pathFailure(code, pathValue, reason) {
  throw new PathSafetyError(code, pathValue, reason);
}

function isWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function assertCanonicalUnicode(value, location) {
  if (typeof value === "string") {
    if (!isWellFormedUnicode(value)) {
      throw new CanonicalizationError(
        "E_CANONICAL_UNICODE",
        location,
        "RFC 8785 requires well-formed Unicode strings.",
      );
    }
    return;
  }
  if (value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertCanonicalUnicode(item, `${location}[${index}]`),
    );
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    assertCanonicalUnicode(key, `${location}.<key>`);
    assertCanonicalUnicode(item, `${location}.${key}`);
  }
}

export function canonicalBytes(value) {
  assertJsonDataModel(value, "<canonical-value>");
  assertCanonicalUnicode(value, "$");
  return Buffer.from(canonicalize(value), "utf8");
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizeMarkdown(text) {
  const normalized = text
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/gu, ""))
    .join("\n")
    .replace(/\n+$/gu, "");
  return `${normalized}\n`;
}

function normalizeRelativePath(pathValue) {
  if (typeof pathValue !== "string") {
    pathFailure("E_PATH_TYPE", String(pathValue), "Path must be a string.");
  }
  if (pathValue.length === 0) {
    pathFailure("E_PATH_EMPTY", pathValue, "Path must not be empty.");
  }
  if (!isWellFormedUnicode(pathValue)) {
    pathFailure(
      "E_PATH_UNICODE",
      pathValue,
      "Path must contain well-formed Unicode.",
    );
  }
  if (pathValue.includes("\u0000")) {
    pathFailure("E_PATH_NUL", pathValue, "Path must not contain NUL.");
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(pathValue)) {
    if (/^[a-z]:[\\/]/iu.test(pathValue)) {
      pathFailure("E_PATH_ABSOLUTE", pathValue, "Drive paths are not allowed.");
    }
    pathFailure("E_PATH_URL", pathValue, "URLs are not allowed.");
  }

  const withForwardSlashes = pathValue.replaceAll("\\", "/");
  if (path.posix.isAbsolute(withForwardSlashes)) {
    pathFailure("E_PATH_ABSOLUTE", pathValue, "Absolute paths are not allowed.");
  }

  const parts = withForwardSlashes.split("/");
  if (parts.some((part) => part === "." || part === "..")) {
    pathFailure(
      "E_PATH_TRAVERSAL",
      pathValue,
      "Dot path segments are not allowed.",
    );
  }

  return parts.filter((part) => part.length > 0).join("/");
}

export function sortRelativePaths(paths) {
  const normalizedPaths = paths.map(normalizeRelativePath);
  const seen = new Set();
  const encodedSeen = new Set();
  for (const pathValue of normalizedPaths) {
    if (seen.has(pathValue)) {
      pathFailure(
        "E_PATH_DUPLICATE",
        pathValue,
        "Duplicate path after normalization.",
      );
    }
    seen.add(pathValue);
    const encodedPath = Buffer.from(pathValue, "utf8").toString("hex");
    if (encodedSeen.has(encodedPath)) {
      pathFailure(
        "E_PATH_DUPLICATE",
        pathValue,
        "Duplicate UTF-8 path after normalization.",
      );
    }
    encodedSeen.add(encodedPath);
  }
  return normalizedPaths.sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
}
