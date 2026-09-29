import path from "node:path";
import { isIP } from "node:net";

import { stringify } from "yaml";

import {
  parseSafeJson,
  parseSafeYaml,
} from "../contracts/safe-data.js";
import { commandResult, issue } from "../shared/result.js";

const WINDOWS_ABSOLUTE =
  /(?:^|[\s("'=:])(?:[A-Za-z]:[\\/][^\s)"']+|\\\\[^\\\s"']+\\[^\\\s"']+)/u;
const STRUCTURED_VALUE =
  /^\s*(?:[-*]\s*)?["']?([A-Za-z_$][A-Za-z0-9_.$ -]{0,63})["']?\s*[:=]\s*["']?(\/(?!\/)[^\s"']+)/u;
const NON_FILESYSTEM_KEYS =
  /(?:url|uri|endpoint|route|href|pointer|json_pointer|schema_pointer|\$ref|reference)/iu;
const NON_FILESYSTEM_CONTEXT =
  /\b(?:(?:json|schema)\s+pointer|(?:url|uri|endpoint|route|href)(?:\s+path)?)\s*(?::|=|\bis|\bto)?\s*$/iu;
const POSIX_TOKEN = /\/(?!\/)[^\s`"'<>]+/gu;
const URL_TOKEN = /https?:\/\/[^\s`"'<>]+/giu;
const HOST_PORT_TOKEN =
  /(?:^|[\s("'`=])(\[[0-9A-Fa-f:.%]+\]|[A-Za-z0-9.-]+):[0-9]{1,5}(?=$|[\s)"'`,;/])/gu;
const FILE_URI_TOKEN = /\bfile\s*:(?=\/|%2f)/giu;
const HOST_AUTHORITY =
  /^\s*(?:[-*]\s*)?["']?(?:host|hostname|server|service|endpoint)["']?\s*[:=]\s*["']?([^\s"',}]+)["']?\s*,?\s*$/gimu;
const AUTHORITY_FIELD =
  /^\s*(?:[-*]\s*)?["']?(customer_name|customer|tenant|tenant_id|tenant-id|tenant_identifier|org|org_id|org-id|org_identifier)["']?\s*[:=]\s*([^,}\r\n]+)/gimu;
const AUTHORITY_KEYS = new Set([
  "customer",
  "customer_name",
  "org",
  "org-id",
  "org_id",
  "org_identifier",
  "tenant",
  "tenant-id",
  "tenant_id",
  "tenant_identifier",
]);
const IMMUTABLE_PATTERNS = [
  [
    "secret",
    "B_SENSITIVE_SECRET",
    /(?:(?:secret|api[_-]?key|private[_-]?key)\s*[:=]\s*\S+|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/gu,
  ],
  [
    "token",
    "B_SENSITIVE_TOKEN",
    /(?:bearer\s+\S+|token\s*[:=]\s*\S+|\beyJ[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{6,}\b)/giu,
  ],
  ["cookie", "B_SENSITIVE_COOKIE", /(?:cookie|set-cookie)\s*[:=]\s*\S+/giu],
  ["profile", "B_SENSITIVE_PROFILE", /(?:profile)\s*[:=]\s*\S+/giu],
];
const PERSONAL_PATTERNS = [
  ["personal-email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu],
  ["personal-phone", /(?<!\d)1[3-9]\d{9}(?!\d)/gu],
  ["personal-id", /(?<!\d)\d{17}[\dXx](?!\d)/gu],
];
const SEMANTIC_IMMUTABLE_KEYS = new Map([
  ...[
    "api_key",
    "api_secret",
    "auth",
    "authentication",
    "authorization",
    "client_key",
    "client_secret",
    "credential",
    "credentials",
    "passphrase",
    "passwd",
    "password",
    "private_key",
    "secret",
    "secret_key",
    "secrets",
  ].map((key) => [key, ["secret", "B_SENSITIVE_SECRET"]]),
  ...[
    "access_token",
    "api_token",
    "auth_token",
    "bearer_token",
    "id_token",
    "refresh_token",
    "session_token",
    "token",
  ].map((key) => [key, ["token", "B_SENSITIVE_TOKEN"]]),
  ...[
    "cookie",
    "cookie_header",
    "cookies",
    "session_cookie",
    "set_cookie",
  ].map((key) => [key, ["cookie", "B_SENSITIVE_COOKIE"]]),
  ...[
    "auth_profile",
    "aws_profile",
    "cloud_profile",
    "credential_profile",
    "credentials_profile",
    "profile",
  ].map((key) => [key, ["profile", "B_SENSITIVE_PROFILE"]]),
]);
const SEMANTIC_INTERNAL_KEYS = new Set([
  "api_endpoint",
  "endpoint",
  "host",
  "host_name",
  "hostname",
  "server",
  "server_host",
  "service",
  "service_endpoint",
  "service_host",
]);

function absolutePathValue(value) {
  return typeof value === "string" &&
    (path.posix.isAbsolute(value) || path.win32.isAbsolute(value));
}

function containsAbsoluteFilesystemPath(text) {
  for (const line of text.split(/\r?\n/gu)) {
    if (WINDOWS_ABSOLUTE.test(line)) return true;
    const structured = line.match(STRUCTURED_VALUE);
    if (structured && !NON_FILESYSTEM_KEYS.test(structured[1])) return true;
    for (const match of line.matchAll(POSIX_TOKEN)) {
      const prefix = line.slice(0, match.index);
      const previous = prefix.at(-1);
      if (
        (previous !== undefined && /[A-Za-z0-9._-]/u.test(previous)) ||
        prefix.endsWith("/") ||
        prefix.endsWith("#") ||
        prefix.endsWith("#!") ||
        /\]\($/u.test(prefix) ||
        /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+$/iu.test(prefix) ||
        NON_FILESYSTEM_CONTEXT.test(prefix) ||
        (
          structured &&
          NON_FILESYSTEM_KEYS.test(structured[1])
        )
      ) {
        continue;
      }
      return true;
    }
  }
  return false;
}

function internalIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

function internalIpv6(hostname) {
  const lower = hostname.toLowerCase().split("%", 1)[0];
  if (lower === "::1") return true;
  const first = Number.parseInt(lower.split(":", 1)[0], 16);
  return (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80
  );
}

function internalHostname(value) {
  const hostname = value.toLowerCase()
    .replace(/^\[/u, "")
    .replace(/\]$/u, "")
    .replace(/\.$/u, "");
  const version = isIP(hostname.split("%", 1)[0]);
  if (version === 4) return internalIpv4(hostname);
  if (version === 6) return internalIpv6(hostname);
  return (
    hostname === "localhost" ||
    !hostname.includes(".") ||
    /\.(?:corp|home|internal|intranet|lan|local|localdomain)$/u.test(hostname)
  );
}

function bareEndpointHost(value) {
  let candidate = value
    .replace(/^[("'`[{<（【《“‘]+/u, "")
    .replace(/[.)"'`\]}>;,!?。）】》”’，。；、！？：…]+$/u, "");
  if (candidate.includes("=")) candidate = candidate.split("=").at(-1);
  if (/^https?:\/\//iu.test(candidate)) {
    try {
      return new URL(candidate).hostname;
    } catch {
      return "";
    }
  }
  if (candidate.startsWith("[")) {
    const closing = candidate.indexOf("]");
    return closing > 0 ? candidate.slice(1, closing) : candidate;
  }
  if (isIP(candidate.split("%", 1)[0]) === 6) return candidate;
  return candidate.split("/", 1)[0];
}

function normalizedSemanticKey(value) {
  return value.normalize("NFKC")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[^A-Za-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toLowerCase();
}

function semanticEndpointHost(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#")
  ) {
    return "";
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(trimmed)) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      // Fall through so malformed authority-like values still fail closed.
    }
  }
  let hostname = bareEndpointHost(trimmed);
  if (isIP(hostname.split("%", 1)[0]) !== 0) return hostname;
  const hostPort = hostname.match(/^(.+):[0-9]{1,5}$/u);
  if (hostPort) hostname = hostPort[1];
  return hostname;
}

function collectSemanticFindings(value) {
  const findings = new Map();
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (current === null || typeof current !== "object") continue;
    for (const [rawKey, child] of Object.entries(current)) {
      const key = normalizedSemanticKey(rawKey);
      const immutable = SEMANTIC_IMMUTABLE_KEYS.get(key);
      if (immutable) {
        const [category, code] = immutable;
        findings.set(code, category);
      }
      if (child === null || typeof child !== "object") {
        const endpointHost = SEMANTIC_INTERNAL_KEYS.has(key)
          ? semanticEndpointHost(child)
          : "";
        if (endpointHost && internalHostname(endpointHost)) {
          findings.set("B_SENSITIVE_INTERNAL_URL", "internal-url");
        }
      } else {
        stack.push(child);
      }
    }
  }
  return findings;
}

function parsedSemanticFindings(text, relativePath) {
  const lowerPath = relativePath.toLowerCase();
  let parser;
  if (lowerPath.endsWith(".json")) parser = parseSafeJson;
  if (/\.(?:ya?ml)$/u.test(lowerPath)) parser = parseSafeYaml;
  if (!parser) return { findings: new Map(), parseError: false };
  try {
    return {
      findings: collectSemanticFindings(parser(text, relativePath)),
      parseError: false,
    };
  } catch {
    return { findings: new Map(), parseError: true };
  }
}

function containsInternalService(text) {
  for (const match of text.matchAll(URL_TOKEN)) {
    try {
      const parsed = new URL(match[0].replace(/[),.;，。；]+$/u, ""));
      if (internalHostname(parsed.hostname)) return true;
    } catch {
      // Invalid URLs are handled by other contract validation.
    }
  }
  for (const match of text.matchAll(HOST_PORT_TOKEN)) {
    if (internalHostname(match[1])) return true;
  }
  for (const rawToken of text.split(/\s+/u)) {
    const normalized = bareEndpointHost(rawToken);
    if (
      isIP(normalized.split("%", 1)[0]) !== 0 &&
      internalHostname(normalized)
    ) {
      return true;
    }
    if (
      /^(?:localhost|intranet)$/iu.test(normalized) ||
      /\.(?:corp|home|internal|intranet|lan|local|localdomain)\.?$/iu
        .test(normalized)
    ) {
      return true;
    }
  }
  for (const match of text.matchAll(HOST_AUTHORITY)) {
    if (internalHostname(bareEndpointHost(match[1]))) return true;
  }
  for (const line of text.split(/\r?\n/gu)) {
    const candidate = line.trim().replace(/^["'`]|["'`,;]$/gu, "");
    if (
      /^(?:api|backend|database|db|frontend|internal|intranet|mysql|postgres|redis|server|service)$/iu
        .test(candidate) &&
      internalHostname(candidate)
    ) {
      return true;
    }
  }
  return false;
}

function containsFileUri(text) {
  FILE_URI_TOKEN.lastIndex = 0;
  return FILE_URI_TOKEN.test(text);
}

function authorityValue(value) {
  let normalized = String(value).trim().replace(/,\s*$/u, "").trim();
  const quote = normalized.at(0);
  if ((quote === "'" || quote === '"') && normalized.at(-1) === quote) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.normalize("NFKC").trim();
}

function collectAuthorityEntries(value) {
  const entries = [];
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (current === null || typeof current !== "object") continue;
    for (const [rawKey, child] of Object.entries(current)) {
      const key = rawKey.toLowerCase();
      if (
        AUTHORITY_KEYS.has(key) &&
        (typeof child === "string" || typeof child === "number")
      ) {
        entries.push({ key, value: authorityValue(child) });
      } else {
        stack.push(child);
      }
    }
  }
  return entries;
}

function parsedAuthorityEntries(text, relativePath) {
  const lowerPath = relativePath.toLowerCase();
  let parser;
  if (lowerPath.endsWith(".json")) parser = parseSafeJson;
  if (/\.(?:ya?ml)$/u.test(lowerPath)) parser = parseSafeYaml;
  if (!parser) return null;
  try {
    return collectAuthorityEntries(parser(text, relativePath));
  } catch {
    return null;
  }
}

function fallbackAuthorityEntries(text, relativePath) {
  const entries = [];
  for (const [index, line] of text.split(/\r?\n/gu).entries()) {
    try {
      const parsed = collectAuthorityEntries(
        parseSafeYaml(line, `${relativePath}:${index + 1}`),
      );
      if (parsed.length > 0) {
        entries.push(...parsed);
        continue;
      }
    } catch {
      // Extract an exact authority field from otherwise non-YAML prose below.
    }
    for (const match of line.matchAll(AUTHORITY_FIELD)) {
      const key = match[1].toLowerCase();
      try {
        const parsed = collectAuthorityEntries(parseSafeYaml(
          `${key}: ${match[2]}`,
          `${relativePath}:${index + 1}`,
        ));
        if (parsed.length > 0) {
          entries.push(...parsed);
          continue;
        }
      } catch {
        // Preserve fail-closed comparison for a malformed field value.
      }
      entries.push({ key, value: authorityValue(match[2]) });
    }
  }
  return entries;
}

function authorityIssues(text, relativePath, options) {
  const issues = [];
  const customerName = typeof options.customerName === "string"
    ? options.customerName.normalize("NFKC").trim()
    : "";
  const allowedTenants = new Set(
    [
      options.currentTenant,
      ...(Array.isArray(options.allowedTenants) ? options.allowedTenants : []),
    ]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.normalize("NFKC").trim()),
  );
  const entries =
    parsedAuthorityEntries(text, relativePath) ??
    fallbackAuthorityEntries(text, relativePath);
  for (const { key, value } of entries) {
    if (key === "customer" || key === "customer_name") {
      issues.push(issue(
        value === customerName && customerName
          ? "INFO"
          : "BLOCKER",
        value === customerName && customerName
          ? "I_CUSTOMER_INFORMATION"
          : "B_OTHER_CUSTOMER",
        relativePath,
        value === customerName && customerName
          ? "Current-project customer information is present."
          : "Another customer authority cannot be delivered.",
        { category: "customer-information" },
      ));
      continue;
    }
    if (!allowedTenants.has(value)) {
      issues.push(issue(
        "BLOCKER",
        "B_OTHER_TENANT",
        relativePath,
        "Another tenant identifier cannot be delivered.",
        { category: "tenant-identifier" },
      ));
    }
  }
  return issues;
}

export function projectSanitizedProjection(manifestBytes) {
  const manifest = parseSafeYaml(
    manifestBytes.toString("utf8"),
    "fde-project.yaml",
  );
  const projected = structuredClone(manifest);
  const redactions = [];
  for (const [index, source] of (projected.sources ?? []).entries()) {
    if (absolutePathValue(source?.original_path)) {
      const replacement = `redacted://source/${index}`;
      source.original_path = replacement;
      redactions.push({
        category: "absolute-source-path",
        path: "fde-project.yaml",
        replacement,
        source_index: index,
      });
    }
  }
  return {
    bytes: Buffer.from(stringify(projected, { lineWidth: 0 }), "utf8"),
    redactions,
  };
}

function exactException(policy, relativePath, category) {
  return (policy?.exceptions ?? []).some((entry) =>
    entry?.path === relativePath &&
    entry?.category === category &&
    typeof entry.reason === "string" &&
    entry.reason.trim().length > 0);
}

function validPolicy(policy) {
  if (
    !policy ||
    typeof policy !== "object" ||
    Array.isArray(policy) ||
    policy.schema_version !== 1 ||
    !Array.isArray(policy.exceptions) ||
    Object.keys(policy).sort().join(",") !== "exceptions,schema_version"
  ) {
    return false;
  }
  const seen = new Set();
  return policy.exceptions.every((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      Object.keys(entry).sort().join(",") !== "category,path,reason" ||
      typeof entry.path !== "string" ||
      entry.path.includes("*") ||
      entry.path.includes("..") ||
      path.posix.isAbsolute(entry.path) ||
      path.win32.isAbsolute(entry.path) ||
      typeof entry.category !== "string" ||
      typeof entry.reason !== "string" ||
      entry.reason.trim().length === 0
    ) {
      return false;
    }
    const key = `${entry.path}\0${entry.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scanSensitiveFiles(files, options) {
  const issues = [];
  const policy = options.policy;
  if (!validPolicy(policy)) {
    issues.push(issue(
      "BLOCKER",
      "B_SCAN_POLICY_INVALID",
      "reports/package-scan-policy.yaml",
      "Scan policy must use exact path/category/reason exceptions.",
    ));
    return commandResult(issues);
  }
  for (const [relativePath, bytes] of files) {
    const text = bytes.toString("utf8");
    const semanticScan = parsedSemanticFindings(text, relativePath);
    if (semanticScan.parseError) {
      issues.push(issue(
        "BLOCKER",
        "B_SENSITIVE_SCAN_UNSCANNABLE",
        relativePath,
        "Structured JSON/YAML must parse safely before sensitive-data scanning.",
      ));
    }
    for (const [category, code, expression] of IMMUTABLE_PATTERNS) {
      expression.lastIndex = 0;
      if (expression.test(text) || semanticScan.findings.has(code)) {
        issues.push(issue(
          "BLOCKER",
          code,
          relativePath,
          `${category} material cannot be included or exempted.`,
          { category },
        ));
      }
    }
    if (
      containsInternalService(text) ||
      semanticScan.findings.has("B_SENSITIVE_INTERNAL_URL")
    ) {
      issues.push(issue(
        "BLOCKER",
        "B_SENSITIVE_INTERNAL_URL",
        relativePath,
        "internal-url material cannot be included or exempted.",
        { category: "internal-url" },
      ));
    }
    if (
      relativePath !== "fde-project.yaml" &&
      (
        containsAbsoluteFilesystemPath(text) ||
        containsFileUri(text)
      )
    ) {
      issues.push(issue(
        "BLOCKER",
        "B_ABSOLUTE_SOURCE_PATH",
        relativePath,
        "Absolute source paths are allowed only as redacted manifest projections.",
      ));
    }
    const scopedAuthorityIssues =
      authorityIssues(text, relativePath, options);
    issues.push(...scopedAuthorityIssues);
    for (const [category, expression] of PERSONAL_PATTERNS) {
      expression.lastIndex = 0;
      if (!expression.test(text)) continue;
      if (!options.confirmPersonalData) {
        issues.push(issue(
          "BLOCKER",
          "B_PERSONAL_DATA_CONFIRMATION",
          relativePath,
          "Personal data requires an explicit packaging confirmation.",
          { category },
        ));
      } else if (!exactException(policy, relativePath, category)) {
        issues.push(issue(
          "BLOCKER",
          "B_PERSONAL_DATA_POLICY",
          relativePath,
          "Personal data requires an exact per-file and per-category policy entry.",
          { category },
        ));
      }
    }
    if (
      options.customerName &&
      text.includes(options.customerName) &&
      !scopedAuthorityIssues.some(({ code }) =>
        code === "I_CUSTOMER_INFORMATION")
    ) {
      issues.push(issue(
        "INFO",
        "I_CUSTOMER_INFORMATION",
        relativePath,
        "Current-project customer information is present.",
        { category: "customer-information" },
      ));
    }
  }
  return commandResult(issues);
}
