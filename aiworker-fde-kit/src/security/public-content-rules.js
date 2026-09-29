import path from "node:path";

const CONTENT_RULES = [
  {
    code: "B_PUBLIC_PRIVATE_KEY",
    pattern:
      /-----BEGIN (?:(?:RSA|DSA|EC|OPENSSH|ENCRYPTED) )?PRIVATE KEY-----/gu,
  },
  {
    code: "B_PUBLIC_TOKEN",
    pattern:
      /["']?(?:access[_-]?token|refresh[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9._:/+-]{8,}|authorization\s*:\s*(?:bearer\s+[A-Za-z0-9._~+/=-]{8,}|basic\s+[A-Za-z0-9+/]{8,}={0,2})/giu,
  },
  {
    code: "B_PUBLIC_TOKEN",
    pattern: /\b(?:AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{16,})\b/gu,
  },
  {
    code: "B_PUBLIC_CREDENTIAL",
    pattern:
      /["']?(?:api[_ -]?key|api[_ -]?secret|client[_ -]?secret|password|passwd|secret[_ -]?key)["']?\s*[:=]\s*["']?(?!(?:true|false|null|undefined)\b)[^\s"'`]+/giu,
  },
  {
    code: "B_PUBLIC_COOKIE",
    pattern:
      /["']?(?:cookie|set-cookie)["']?\s*:\s*["']?[A-Za-z0-9._~+/=;:-]{3,}/giu,
  },
  {
    code: "B_PUBLIC_PROFILE",
    pattern:
      /["']profile["']\s*:\s*["']?(?!none\b|null\b|fixture\b|test\b|--)[A-Za-z0-9][A-Za-z0-9._-]{2,}["']?/giu,
  },
  {
    code: "B_PUBLIC_PROFILE",
    pattern:
      /^\s*["']?profile["']?\s*:\s*["']?(?!none["']?\s*$|null["']?\s*$|fixture\b|test\b|--)[A-Za-z0-9][A-Za-z0-9._-]{2,}["']?\s*$/gimu,
  },
  {
    code: "B_PUBLIC_PROFILE",
    pattern:
      /^\s*["']?profile["']?\s*:\s*[>|][-+]?\s*\r?\n[ \t]+["']?(?!none["']?\s*$|null["']?\s*$|fixture\b|test\b|--)[A-Za-z0-9][A-Za-z0-9._-]{2,}["']?\s*$/gimu,
  },
  {
    code: "B_PUBLIC_ABSOLUTE_PATH",
    pattern:
      /(?:\/Users\/|\/home\/)[^/\s"'`]+\/[^\s"'`]*|\/root\/[^\s"'`]+|[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`]+[\\/]+[^\s"'`]*/giu,
  },
  {
    code: "B_PUBLIC_INTERNAL_ADDRESS",
    pattern:
      /(?:https?:\/\/)?(?:[A-Za-z0-9-]+\.)+(?:corp|internal)\b|(?:https?:\/\/)?(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/[^\s"'`]*)?/giu,
  },
  {
    code: "B_PUBLIC_INTERNAL_ADDRESS",
    pattern:
      /(?:https?:\/\/)?\[(?:::1|f[cd][0-9a-f]{2}:[0-9a-f:.%]*|fe[89ab][0-9a-f]:[0-9a-f:.%]*)\](?::\d+)?(?:\/[^\s"'`]*)?/giu,
  },
  {
    code: "B_PUBLIC_IDENTITY",
    pattern: /(?<![0-9A-Fa-f])1[3-9]\d{9}(?![0-9A-Fa-f])/gu,
  },
  {
    code: "B_PUBLIC_IDENTITY",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  },
  {
    code: "B_PUBLIC_IDENTITY",
    pattern:
      /(?:客户|公司|联系人|姓名)\s*[：:=]\s*[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9·（）() -]{1,30}/gu,
  },
];

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".txt",
  ".yaml",
  ".yml",
]);

export function publicContentFindingCodes(text) {
  const codes = new Set();
  for (const rule of CONTENT_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) codes.add(rule.code);
  }
  return [...codes];
}

export function publicFilenameFindingCodes(relativePath) {
  const codes = new Set();
  for (const segment of relativePath.toLowerCase().split("/")) {
    if (segment === ".env" || segment.startsWith(".env.")) {
      codes.add("B_PUBLIC_ENV_FILE");
    }
    if (
      /(?:^|[-_.])(?:id_)?(?:rsa|dsa|ecdsa|ed25519)(?:$|[-_.])/u.test(segment) ||
      /\.(?:pem|p12|pfx|key)$/u.test(segment)
    ) {
      codes.add("B_PUBLIC_PRIVATE_KEY");
    }
    if (
      /(?:^|[-_.])(?:(?:access|refresh)[-_]?token|bearer(?:[-_]?token)?)(?:$|[-_.])/u
        .test(segment)
    ) {
      codes.add("B_PUBLIC_TOKEN");
    }
    if (/(?:^|[-_.])cookie(?:s)?(?:$|[-_.])/u.test(segment)) {
      codes.add("B_PUBLIC_COOKIE");
    }
    if (/(?:^|[-_.])profile(?:s)?(?:$|[-_.])/u.test(segment)) {
      codes.add("B_PUBLIC_PROFILE");
    }
  }
  return [...codes];
}

export function isRecognizedTextPath(relativePath, text) {
  const basename = path.posix.basename(relativePath);
  if (basename === ".gitignore" || basename === "LICENSE") return true;
  if (TEXT_EXTENSIONS.has(path.posix.extname(basename).toLowerCase())) {
    return true;
  }
  return path.posix.extname(basename) === "" && text.startsWith("#!");
}
