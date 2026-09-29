import {
  chmod,
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { main } from "../../src/security/public-scan.js";

const exec = promisify(execFile);
let temporaryRoot;
const fixtureText = (...parts) => parts.join("");

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-public-scan-"));
});

afterEach(async () => {
  await chmod(temporaryRoot, 0o700).catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function createRepository(files = {}) {
  const repository = path.join(temporaryRoot, "repository");
  await mkdir(repository);
  await exec("git", ["init", "-q", repository]);
  for (const [relativePath, bytes] of Object.entries(files)) {
    const destination = path.join(repository, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  return repository;
}

async function invoke(args, options = {}) {
  const chunks = [];
  const exitCode = await main(args, {
    ...options,
    cwd: options.cwd ?? temporaryRoot,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  expect(chunks).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

describe("public repository scan", () => {
  it("accepts a clean repository and scans tracked plus nonignored untracked files", async () => {
    const repository = await createRepository({
      "README.md": "# Public fixture\n",
      "digest.txt":
        "91562a9e95e2ccad033a59a7157b18526916597b99b9aa333b489bd8c5a515ca\n",
      tool: "#!/usr/bin/env bash\nset -euo pipefail\n",
      "untracked.txt": "safe test data\n",
    });
    await exec("git", ["-C", repository, "add", "README.md"]);
    const response = await invoke([repository]);
    expect(response.exitCode).toBe(0);
    expect(response.result.data).toMatchObject({
      clean: true,
      scanned_files: 4,
    });
  });

  it("does not treat a password UI schema boolean as a credential value", async () => {
    const repository = await createRepository({
      "schema.js": fixtureText(
        "export const uiHints = { pass",
        "word: true };\n",
      ),
    });
    const response = await invoke([repository]);
    expect(response.exitCode).toBe(0);
    expect(response.result.data.clean).toBe(true);
  });

  it.each([
    [".env", "SAFE=still-forbidden\n", "B_PUBLIC_ENV_FILE"],
    [
      "keys/id.pem",
      fixtureText("-----BEGIN ", "PRIVATE ", "KEY-----\n"),
      "B_PUBLIC_PRIVATE_KEY",
    ],
    [
      "notes.md",
      fixtureText("access", "_token: ", "live-value-123456\n"),
      "B_PUBLIC_TOKEN",
    ],
    [
      "data.json",
      fixtureText('{"access', '_token":"json-secret-value"}\n'),
      "B_PUBLIC_TOKEN",
    ],
    [
      "notes.md",
      fixtureText("Authorization: ", "Bearer ", "live-value-123456\n"),
      "B_PUBLIC_TOKEN",
    ],
    [
      "notes.md",
      fixtureText("Coo", "kie: session=live-value\n"),
      "B_PUBLIC_COOKIE",
    ],
    [
      "data.json",
      fixtureText('{"coo', 'kie":"json-cookie-value"}\n'),
      "B_PUBLIC_COOKIE",
    ],
    [
      "profiles/admin.json",
      fixtureText('{"pro', 'file":"production-admin"}\n'),
      "B_PUBLIC_PROFILE",
    ],
    [
      "notes.yaml",
      fixtureText("pro", 'file: "production-admin"\n'),
      "B_PUBLIC_PROFILE",
    ],
    [
      "notes.json",
      fixtureText('{"pro', 'file": production-admin}\n'),
      "B_PUBLIC_PROFILE",
    ],
    [
      "notes.yaml",
      fixtureText("pro", "file: >\n  production-admin\n"),
      "B_PUBLIC_PROFILE",
    ],
    [
      "notes.md",
      fixtureText(
        "-----BEGIN ",
        "ENCRYPTED ",
        "PRIVATE ",
        "KEY-----\n",
      ),
      "B_PUBLIC_PRIVATE_KEY",
    ],
    [
      "notes.md",
      fixtureText("-----BEGIN ", "DSA ", "PRIVATE ", "KEY-----\n"),
      "B_PUBLIC_PRIVATE_KEY",
    ],
    [
      "notes.md",
      fixtureText("Authorization: ", "Basic ", "dXNl", "cjpwYXNz\n"),
      "B_PUBLIC_TOKEN",
    ],
    [
      "credentials.json",
      fixtureText('{"api_', 'key":"live-api-key-value"}\n'),
      "B_PUBLIC_CREDENTIAL",
    ],
    [
      "credentials.yaml",
      fixtureText("api_", "secret: live-api-secret-value\n"),
      "B_PUBLIC_CREDENTIAL",
    ],
    [
      "credentials.json",
      fixtureText('{"client_', 'secret":"live-client-secret-value"}\n'),
      "B_PUBLIC_CREDENTIAL",
    ],
    [
      "credentials.yaml",
      fixtureText("pass", "word: live-password-value\n"),
      "B_PUBLIC_CREDENTIAL",
    ],
    [
      "credentials.env.txt",
      fixtureText("PASS", "WD=live-passwd-value\n"),
      "B_PUBLIC_CREDENTIAL",
    ],
    [
      "credentials.yaml",
      fixtureText("secret ", "key: live-secret-key-value\n"),
      "B_PUBLIC_CREDENTIAL",
    ],
    [
      "contacts.md",
      fixtureText("release-owner", "@", "example.com\n"),
      "B_PUBLIC_IDENTITY",
    ],
    [
      "notes.md",
      fixtureText("/Us", "ers/alice/customer/brief.txt\n"),
      "B_PUBLIC_ABSOLUTE_PATH",
    ],
    [
      "notes.md",
      fixtureText("/ho", "me/alice/customer/brief.txt\n"),
      "B_PUBLIC_ABSOLUTE_PATH",
    ],
    [
      "notes.md",
      fixtureText("/ro", "ot/alice/customer/brief.txt\n"),
      "B_PUBLIC_ABSOLUTE_PATH",
    ],
    [
      "notes.md",
      fixtureText("C:\\Us", "ers\\Alice\\customer\\brief.txt\n"),
      "B_PUBLIC_ABSOLUTE_PATH",
    ],
    [
      "notes.md",
      fixtureText("https://orders.", "corp.", "internal/api\n"),
      "B_PUBLIC_INTERNAL_ADDRESS",
    ],
    [
      "notes.md",
      fixtureText("http://10.22.", "33.44/api\n"),
      "B_PUBLIC_INTERNAL_ADDRESS",
    ],
    [
      "notes.md",
      fixtureText("https://api.", "corp/v1\n"),
      "B_PUBLIC_INTERNAL_ADDRESS",
    ],
    [
      "notes.md",
      fixtureText("http://169.254.", "10.2:8080\n"),
      "B_PUBLIC_INTERNAL_ADDRESS",
    ],
    [
      "notes.md",
      fixtureText("http://127.0.", "0.2:8080\n"),
      "B_PUBLIC_INTERNAL_ADDRESS",
    ],
    [
      "notes.md",
      fixtureText("https://[fd12:", "3456::1]/api\n"),
      "B_PUBLIC_INTERNAL_ADDRESS",
    ],
    [
      "notes.md",
      fixtureText("https://[fe80:", ":1234]/api\n"),
      "B_PUBLIC_INTERNAL_ADDRESS",
    ],
    [
      "contacts.md",
      fixtureText(
        "客",
        "户：真实集团；联",
        "系人：王敏；电话：",
        "13812",
        "345678\n",
      ),
      "B_PUBLIC_IDENTITY",
    ],
    ["blob.bin", Buffer.from([0, 159, 146, 150]), "B_PUBLIC_BINARY_UNKNOWN"],
    ["payload.dat", "ASCII is still an unknown file type\n", "B_PUBLIC_BINARY_UNKNOWN"],
    ["access-token.txt", "safe text\n", "B_PUBLIC_TOKEN"],
    ["access-token/safe.txt", "safe text\n", "B_PUBLIC_TOKEN"],
    ["refresh_token.md", "safe text\n", "B_PUBLIC_TOKEN"],
    ["bearer-token.yaml", "safe: true\n", "B_PUBLIC_TOKEN"],
    ["session-cookie.txt", "safe text\n", "B_PUBLIC_COOKIE"],
    ["auth-profile.json", "{}\n", "B_PUBLIC_PROFILE"],
    ["auth-profile/safe.json", "{}\n", "B_PUBLIC_PROFILE"],
    ["id_rsa", "not a key\n", "B_PUBLIC_PRIVATE_KEY"],
  ])("blocks public leak class %#", async (filename, content, code) => {
    const repository = await createRepository({ [filename]: content });
    const response = await invoke([repository]);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it("does not use git ignored files as a hiding place", async () => {
    const repository = await createRepository({
      ".gitignore": "ignored.txt\n",
      "ignored.txt": fixtureText(
        "access",
        "_token: ",
        "ignored-secret-value\n",
      ),
      "visible.txt": "safe\n",
    });
    const response = await invoke([repository]);
    expect(response.exitCode).toBe(0);
    expect(response.result.data.scanned_files).toBe(2);
  });

  it("uses exact exit boundaries for invocation and runtime failures", async () => {
    expect((await invoke(["relative"])).exitCode).toBe(2);
    expect((await invoke([temporaryRoot, "--unknown"])).exitCode).toBe(2);
    expect((await invoke(["--help"])).exitCode).toBe(0);
    expect((await invoke([path.join(temporaryRoot, "missing")])).exitCode)
      .toBe(3);

    const repository = await createRepository({ "safe.txt": "safe\n" });
    const runtime = await invoke([repository], {
      listFiles: () => {
        throw new Error("injected unreadable repository");
      },
    });
    expect(runtime.exitCode).toBe(3);
  });

  it.each([
    [fixtureText("access", "_token: malicious-value-123"), []],
    [fixtureText("-----BEGIN ", "PRIVATE ", "KEY-----"), []],
    [fixtureText("/ho", "me/alice/private"), []],
    [fixtureText("service.", "corp.", "internal"), []],
    [fixtureText("13812", "345678"), []],
    ["星河科技", ["access[_-]?token"]],
  ])("rejects dangerous allowlist definition %#", async (literal, patterns) => {
    const repository = await createRepository({ "safe.txt": "safe\n" });
    const allowlistPath = path.join(temporaryRoot, "allowlist.yaml");
    await writeFile(
      allowlistPath,
      [
        "schema_version: 1",
        "allowed_literals:",
        `  - value: ${JSON.stringify(literal)}`,
        "    paths: [assets/examples/**]",
        `allowed_patterns: ${JSON.stringify(patterns)}`,
        "",
      ].join("\n"),
    );
    const response = await invoke([repository], { allowlistPath });
    expect(response.exitCode).toBe(3);
    expect(response.result.issues[0].code).toBe("B_PUBLIC_SCAN_RUNTIME");
  });

  it("rejects unknown fields on allowed literal entries", async () => {
    const repository = await createRepository({ "safe.txt": "safe\n" });
    const allowlistPath = path.join(temporaryRoot, "literal-policy.yaml");
    await writeFile(
      allowlistPath,
      [
        "schema_version: 1",
        "allowed_literals:",
        '  - value: "星河科技"',
        "    paths: [assets/examples/**]",
        "    unknown_key: ignored",
        "allowed_patterns: []",
        "",
      ].join("\n"),
    );
    const response = await invoke([repository], { allowlistPath });
    expect(response.exitCode).toBe(3);
    expect(response.result.issues[0].code).toBe("B_PUBLIC_SCAN_RUNTIME");
  });

  it("rejects detector fixture exemptions even when path and digest match", async () => {
    const relativePath = "test/integration/public-scan.test.js";
    const secret = ["access", "_token: ", "runtime-secret-value"].join("");
    const repository = await createRepository({ [relativePath]: secret });
    const digest = createHash("sha256").update(secret).digest("hex");
    const allowlistPath = path.join(temporaryRoot, "fixture-policy.yaml");
    await writeFile(
      allowlistPath,
      [
        "schema_version: 1",
        "allowed_literals: []",
        "allowed_patterns: []",
        "detector_fixtures:",
        `  - path: ${relativePath}`,
        `    sha256: ${digest}`,
        "",
      ].join("\n"),
    );
    const response = await invoke([repository], { allowlistPath });
    expect(response.exitCode).toBe(3);
    expect(response.result.issues[0].code).toBe("B_PUBLIC_SCAN_RUNTIME");
  });
});
