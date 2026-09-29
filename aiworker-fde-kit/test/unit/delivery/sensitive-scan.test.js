import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { parse, stringify } from "yaml";

import {
  createOfficialSchemaRegistry,
  SCHEMA_IDS,
  validateSchema,
} from "../../../src/contracts/schema-registry.js";
import {
  projectSanitizedProjection,
  scanSensitiveFiles,
} from "../../../src/delivery/sensitive-scan.js";

const fixtureText = (...parts) => parts.join("");

describe("delivery sensitive scanning", () => {
  it("redacts only manifest source paths without mutating the input bytes", () => {
    const originalPath = fixtureText("/Us", "ers/fde/customer/brief.docx");
    const original = Buffer.from(stringify({
      project: { customer_name: "星河科技" },
      sources: [
        { id: "a", original_path: originalPath },
        { id: "b", original_path: "inputs/source-files/copied.txt" },
      ],
    }));
    const projected = projectSanitizedProjection(original);

    expect(parse(original.toString()).sources[0].original_path)
      .toBe(originalPath);
    expect(parse(projected.bytes.toString()).sources[0].original_path)
      .toBe("redacted://source/0");
    expect(projected.redactions).toEqual([{
      category: "absolute-source-path",
      path: "fde-project.yaml",
      replacement: "redacted://source/0",
      source_index: 0,
    }]);
  });

  it("produces a schema-valid portable staging URI for file sources", async () => {
    const originalPath = fixtureText("/Us", "ers/fde/customer/brief.txt");
    const fixture = parse(
      await readFile(
        new URL(
          "../../../assets/examples/lead-collector/expected-project/fde-project.yaml",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    fixture.sources = [{
      id: "source.requirements_conversation",
      title: "需求文件",
      kind: "file",
      source_mode: "copy",
      status: "readable",
      portable: true,
      original_path: originalPath,
      copy_path: "inputs/source-files/brief.txt",
      sha256: "a".repeat(64),
      media_type: "text/plain",
      read_status: "read",
      copied_at: "2026-07-24T01:00:00Z",
    }];
    const projected = parse(projectSanitizedProjection(
      Buffer.from(stringify(fixture, { lineWidth: 0 })),
    ).bytes.toString());
    const registry = await createOfficialSchemaRegistry();
    expect(validateSchema(registry, SCHEMA_IDS.project, projected))
      .toMatchObject({ valid: true });
  });

  it("never exempts credentials, tokens, cookies, profiles, internal URLs, or other tenants", () => {
    const files = new Map([[
      "design/team-design.md",
      Buffer.from([
        "secret=fixture-secret",
        "token: fixture-token",
        fixtureText("Coo", "kie: session=x"),
        "profile=prod-admin",
        fixtureText("https://service.", "corp.", "internal/api"),
        "tenant_id: another-tenant",
      ].join("\n")),
    ]]);
    const policy = {
      schema_version: 1,
      exceptions: [
        {
          path: "design/team-design.md",
          category: "secret",
          reason: "attempted broad exemption",
        },
      ],
    };
    const result = scanSensitiveFiles(files, {
      policy,
      customerName: "星河科技",
      currentTenant: "current-tenant",
      confirmPersonalData: true,
    });
    expect(result.issues.filter(({ severity }) => severity === "BLOCKER")
      .map(({ code }) => code)).toEqual(expect.arrayContaining([
        "B_SENSITIVE_SECRET",
        "B_SENSITIVE_TOKEN",
        "B_SENSITIVE_COOKIE",
        "B_SENSITIVE_PROFILE",
        "B_SENSITIVE_INTERNAL_URL",
        "B_OTHER_TENANT",
      ]));
  });

  it("requires exact per-file and per-category policy plus explicit PII confirmation", () => {
    const files = new Map([
      [
        "design/a.md",
        Buffer.from(fixtureText(
          "owner", "@", "example.com ",
          "13900",
          "000002 星河科技",
        )),
      ],
      ["design/b.md", Buffer.from(fixtureText("other", "@", "example.com"))],
    ]);
    const policy = {
      schema_version: 1,
      exceptions: [{
        path: "design/a.md",
        category: "personal-email",
        reason: "approved delivery contact",
      }, {
        path: "design/a.md",
        category: "personal-phone",
        reason: "approved acceptance fixture",
      }],
    };
    const denied = scanSensitiveFiles(files, {
      policy,
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(denied.issues.some(({ code }) => code === "B_PERSONAL_DATA_CONFIRMATION"))
      .toBe(true);
    const confirmed = scanSensitiveFiles(files, {
      policy,
      customerName: "星河科技",
      confirmPersonalData: true,
    });
    expect(confirmed.issues).toContainEqual(expect.objectContaining({
      code: "I_CUSTOMER_INFORMATION",
      severity: "INFO",
    }));
    expect(confirmed.issues).toContainEqual(expect.objectContaining({
      code: "B_PERSONAL_DATA_POLICY",
      path: "design/b.md",
      details: expect.objectContaining({ category: "personal-email" }),
    }));
    expect(confirmed.issues).not.toContainEqual(expect.objectContaining({
      code: "B_PERSONAL_DATA_POLICY",
      path: "design/a.md",
    }));
  });

  it("blocks absolute source paths outside fde-project.yaml", () => {
    const files = new Map([
      [
        "design/users.md",
        Buffer.from(fixtureText("Source: /Us", "ers/fde/private.docx\n")),
      ],
      ["design/opt.md", Buffer.from("artifact_path: /opt/customer/a.txt\n")],
      ["design/mnt.md", Buffer.from("file=/mnt/share/a.txt\n")],
      ["design/tmp.md", Buffer.from("source: /tmp/private.txt\n")],
      ["design/var.md", Buffer.from("location=/var/lib/private.json\n")],
      ["design/parentheses.md", Buffer.from("请读取（/opt/客户/brief.txt）。\n")],
      ["design/backticks.md", Buffer.from("挂载点是 `/mnt/share/a.txt`。\n")],
      ["design/chinese.md", Buffer.from("临时文件 /tmp/private.txt 请删除。\n")],
      ["design/chinese-adjacent.md", Buffer.from("请读取/opt/客户/brief.txt。\n")],
      ["design/windows.md", Buffer.from("path: C:\\customer\\brief.docx\n")],
      ["design/unc.md", Buffer.from("source: \\\\server\\share\\brief.docx\n")],
    ]);
    const result = scanSensitiveFiles(files, {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(result.issues.filter(({ code }) =>
      code === "B_ABSOLUTE_SOURCE_PATH")).toHaveLength(files.size);
  });

  it("does not confuse URLs, JSON pointers, or documented routes with filesystem paths", () => {
    const result = scanSensitiveFiles(new Map([[
      "design/references.md",
      Buffer.from([
        "url: https://example.com/api/v1",
        "See https://example.com/downloads/file.tar.gz for details.",
        "schema_pointer: #/definitions/worker",
        "JSON pointer is #/properties/assembly/assembly_execution.",
        "Use JSON pointer /properties/worker/name.",
        "The URL path /downloads/file.tar.gz is public.",
        "Document route /api/v2/workers.",
        "route: /api/v1/workers",
        "GET /api/v1/workers",
        "[guide](/docs/getting-started)",
      ].join("\n")),
    ]]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_ABSOLUTE_SOURCE_PATH",
    }));
  });

  it("blocks private, loopback, link-local, and intranet service endpoints", () => {
    const files = new Map([
      [
        "design/ten.md",
        Buffer.from(fixtureText("http://10.1.", "2.3/api\n")),
      ],
      [
        "design/seventeen.md",
        Buffer.from(fixtureText("172.31.", "255.254:8443\n")),
      ],
      [
        "design/nineteen.md",
        Buffer.from(fixtureText("https://192.168.", "1.2/status\n")),
      ],
      [
        "design/loopback.md",
        Buffer.from(fixtureText("http://127.0.", "0.1:3000\n")),
      ],
      [
        "design/link-local.md",
        Buffer.from(fixtureText("169.254.", "10.2:8080\n")),
      ],
      [
        "design/ipv6-loopback.md",
        Buffer.from(fixtureText("http://[::", "1]:8080\n")),
      ],
      [
        "design/ipv6-ula.md",
        Buffer.from(fixtureText("https://[fd12:", "3456::1]/api\n")),
      ],
      [
        "design/ipv6-link-local.md",
        Buffer.from(fixtureText("[fe80:", ":1234]:443\n")),
      ],
      ["design/single-label.md", Buffer.from("http://intranet/api\n")],
      ["design/local.md", Buffer.from("api.service.local:9443\n")],
    ]);
    const result = scanSensitiveFiles(files, {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(result.issues.filter(({ code }) =>
      code === "B_SENSITIVE_INTERNAL_URL")).toHaveLength(files.size);
  });

  it("blocks bare internal endpoint tokens without a scheme or port", () => {
    const files = new Map([
      ["design/bare-ten.md", Buffer.from(fixtureText("10.20.", "30.40\n"))],
      [
        "design/bare-loopback.md",
        Buffer.from(fixtureText("127.0.", "0.2\n")),
      ],
      [
        "design/bare-link-local.md",
        Buffer.from(fixtureText("169.254.", "20.30\n")),
      ],
      [
        "design/bare-ula.md",
        Buffer.from(fixtureText("fd12:", "3456::1\n")),
      ],
      [
        "design/bare-v6-link.md",
        Buffer.from(fixtureText("fe80:", ":1234\n")),
      ],
      [
        "design/bare-v6-loop.md",
        Buffer.from(fixtureText("::", "1\n")),
      ],
      [
        "design/bare-internal.md",
        Buffer.from(fixtureText("service.", "internal\n")),
      ],
      ["design/bare-corp.md", Buffer.from(fixtureText("api.", "corp\n"))],
      ["design/bare-local.md", Buffer.from("printer.local\n")],
      ["design/bare-single.md", Buffer.from("intranet\n")],
      ["design/host-context.md", Buffer.from("host: backend\n")],
      [
        "design/endpoint-assignment.md",
        Buffer.from(fixtureText("endpoint=10.30.", "40.50\n")),
      ],
      [
        "design/address-path.md",
        Buffer.from(fixtureText("10.40.", "50.60/api\n")),
      ],
      ["design/standalone-host.md", Buffer.from("backend\n")],
      [
        "design/trailing-period.md",
        Buffer.from(fixtureText("10.50.", "60.70.\n")),
      ],
      [
        "design/chinese-punctuation.md",
        Buffer.from(fixtureText("（10.60.", "70.80。）\n")),
      ],
      [
        "design/chinese-colon.md",
        Buffer.from(fixtureText("10.70.", "80.90：\n")),
      ],
      [
        "design/chinese-ellipsis.md",
        Buffer.from(fixtureText("10.80.", "90.100…\n")),
      ],
    ]);
    const result = scanSensitiveFiles(files, {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(result.issues.filter(({ code }) =>
      code === "B_SENSITIVE_INTERNAL_URL")).toHaveLength(files.size);
  });

  it("allows public URLs and public host-port endpoints", () => {
    const result = scanSensitiveFiles(new Map([[
      "design/public-services.md",
      Buffer.from([
        "https://8.8.8.8/dns-query",
        "endpoint: https://example.com/api",
        "example.com:443",
        "[2001:4860:4860::8888]:443",
        "version: 10.2.3",
        "public address: 172.15.2.3",
        "invalid IP-like value: 999.168.1.1",
        "release: fd12",
      ].join("\n")),
    ]]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_SENSITIVE_INTERNAL_URL",
    }));
  });

  it("blocks file URIs including encoded and malformed forms", () => {
    const files = new Map([
      ["design/file-uri.md", Buffer.from("file:///opt/private/data.json\n")],
      ["design/file-localhost.md", Buffer.from("file://localhost/tmp/a.txt\n")],
      ["design/file-encoded.md", Buffer.from("file:///%6fpt/private.txt\n")],
      ["design/file-malformed.md", Buffer.from("file:///%E0%A4%A\n")],
      ["design/file-encoded-delimiter.md",
        Buffer.from("file:%2f%2f%2fopt%2fprivate.txt\n")],
    ]);
    const result = scanSensitiveFiles(files, {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(result.issues.filter(({ code }) =>
      code === "B_ABSOLUTE_SOURCE_PATH")).toHaveLength(files.size);
  });

  it("compares only structured customer and tenant authority fields", () => {
    const allowed = scanSensitiveFiles(new Map([[
      "design/current-authority.yaml",
      Buffer.from([
        "customer_name: 星河科技 # current customer",
        "tenant_id: tenant-current # current tenant",
        "tenant: tenant-alias",
        "org: tenant-current",
      ].join("\n")),
    ]]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      currentTenant: "tenant-current",
      allowedTenants: ["tenant-alias"],
      confirmPersonalData: false,
    });
    expect(allowed.issues).not.toContainEqual(expect.objectContaining({
      code: expect.stringMatching(/^B_OTHER_/u),
    }));
    expect(allowed.issues).toContainEqual(expect.objectContaining({
      code: "I_CUSTOMER_INFORMATION",
      severity: "INFO",
    }));

    const fallback = scanSensitiveFiles(new Map([
      ["design/fallback.md", Buffer.from([
        "customer_name: \"星河 # 科技\" # current customer",
        "tenant_id: \"tenant#current\" # current tenant",
      ].join("\n"))],
      ["design/semantic.json", Buffer.from(JSON.stringify({
        description: " tenant_id: tenant-other",
      }))],
    ]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河 # 科技",
      currentTenant: "tenant#current",
      confirmPersonalData: false,
    });
    expect(fallback.issues).not.toContainEqual(expect.objectContaining({
      code: expect.stringMatching(/^B_OTHER_/u),
    }));
    expect(fallback.issues).toContainEqual(expect.objectContaining({
      code: "I_CUSTOMER_INFORMATION",
      severity: "INFO",
      path: "design/fallback.md",
    }));

    const rejected = scanSensitiveFiles(new Map([
      ["design/other-authority.yaml", Buffer.from([
        "customer: 其他客户",
        "tenant-id: tenant-other",
        "tenant_identifier: tenant-third",
        "org: tenant-fourth",
      ].join("\n"))],
      ["acceptance/fictional-lead.yaml", Buffer.from([
        "company_name: 虚构线索公司",
        "lead_company: 另一家虚构公司",
        "lead customer: 虚构潜客",
      ].join("\n"))],
      ["acceptance/fictional-lead.md", Buffer.from(
        "lead customer: 虚构潜客\n",
      )],
      ["design/compact-authority.json", Buffer.from(
        "{\"tenant_id\":\"tenant-fifth\"}\n",
      )],
      ["design/inline-authority.yaml", Buffer.from(
        "authority: { tenant: tenant-sixth }\n",
      )],
    ]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      currentTenant: "tenant-current",
      allowedTenants: ["tenant-alias"],
      confirmPersonalData: false,
    });
    expect(rejected.issues).toContainEqual(expect.objectContaining({
      code: "B_OTHER_CUSTOMER",
      path: "design/other-authority.yaml",
    }));
    expect(rejected.issues.filter(({ code }) =>
      code === "B_OTHER_TENANT")).toHaveLength(5);
    expect(rejected.issues.filter(({ severity }) =>
      severity === "BLOCKER").some(({ path: issuePath }) =>
      issuePath.startsWith("acceptance/fictional-lead."))).toBe(false);
  });

  it("classifies exact sensitive keys recursively in JSON and YAML", () => {
    const cookieKey = fixtureText("coo", "kie");
    const apiKeyField = fixtureText("api", "Key");
    const passwordKey = fixtureText("pass", "word");
    const structuredFiles = new Map([
      ["design/nested-sensitive.json", Buffer.from(JSON.stringify({
        envelope: {
          entries: [
            { token: "json-token" },
            { [apiKeyField]: "json-api-key" },
            { [passwordKey]: "json-password" },
            { [cookieKey]: "json-cookie" },
            { profile: "json-profile" },
            { privateKey: "json-private-key" },
            { credentials: { username: "nested-user" } },
            { auth: "json-auth" },
            { host: "backend" },
          ],
        },
      }))],
      ["design/nested-sensitive.yaml", Buffer.from([
        "envelope:",
        fixtureText(
          "  entries: [{ \"token\": \"yaml-token\" }, { \"api_",
          "key\": \"yaml-api-key\" }, { \"secret\": \"yaml-secret\" }, { \"pass",
          "word\": \"yaml-password\" }, { \"cookie\": \"yaml-cookie\" }, { \"profile\": \"yaml-profile\" }, { \"hostname\": \"database\" }, { \"server\": \"cache\" }, { \"service\": \"queue\" }, { \"endpoint\": \"worker\" }]",
        ),
      ].join("\n"))],
    ]);

    const result = scanSensitiveFiles(structuredFiles, {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });

    for (const relativePath of structuredFiles.keys()) {
      expect(result.issues.filter(({ path: issuePath }) =>
        issuePath === relativePath).map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          "B_SENSITIVE_SECRET",
          "B_SENSITIVE_TOKEN",
          "B_SENSITIVE_COOKIE",
          "B_SENSITIVE_PROFILE",
          "B_SENSITIVE_INTERNAL_URL",
        ]),
      );
    }
  });

  it("normalizes common structured sensitive-key variants exactly", () => {
    const cases = [
      ["accessToken", "B_SENSITIVE_TOKEN"],
      ["refresh-token", "B_SENSITIVE_TOKEN"],
      ["api-key", "B_SENSITIVE_SECRET"],
      ["apiKey", "B_SENSITIVE_SECRET"],
      ["privateKey", "B_SENSITIVE_SECRET"],
      ["credentials", "B_SENSITIVE_SECRET"],
      ["authorization", "B_SENSITIVE_SECRET"],
      ["setCookie", "B_SENSITIVE_COOKIE"],
      ["session_cookie", "B_SENSITIVE_COOKIE"],
      ["awsProfile", "B_SENSITIVE_PROFILE"],
      ["credential-profile", "B_SENSITIVE_PROFILE"],
      ["hostName", "B_SENSITIVE_INTERNAL_URL"],
      ["apiEndpoint", "B_SENSITIVE_INTERNAL_URL"],
    ];
    const files = new Map(cases.map(([key]) => [
      `design/semantic-${key}.json`,
      Buffer.from(JSON.stringify({ wrapper: [{ [key]: "backend" }] })),
    ]));

    const result = scanSensitiveFiles(files, {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });

    for (const [key, expectedCode] of cases) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: expectedCode,
        path: `design/semantic-${key}.json`,
      }));
    }
  });

  it("does not classify fictional lookalike fields or public endpoints", () => {
    const result = scanSensitiveFiles(new Map([[
      "acceptance/fictional-business.json",
      Buffer.from(JSON.stringify({
        leads: [{
          customerProfile: "fictional buyer persona",
          apiKeyLabel: "demo field label",
          tokenBudget: 4096,
          cookieRecipe: "fictional product name",
          secretSanta: "fictional campaign",
          passwordPolicy: "fictional requirements",
          authStrategy: "fictional workflow",
          serviceName: "fictional consulting",
          hostess: "fictional contact role",
        }],
        infrastructure: {
          host: "example.com",
          endpoint: "https://api.example.com/v1",
          serviceEndpoint: "postgresql://db.example.com:5432/app",
        },
      })),
    ]]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });

    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: expect.stringMatching(/^B_SENSITIVE_/u),
    }));
  });

  it("fails closed when declared JSON or YAML cannot be parsed", () => {
    const result = scanSensitiveFiles(new Map([
      [
        "design/broken.json",
        Buffer.from(fixtureText('{"pass', 'word":"hunter2",')),
      ],
      [
        "design/broken.yaml",
        Buffer.from(fixtureText("pass", "word: [unterminated")),
      ],
    ]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });

    expect(result.issues.filter(({ code }) =>
      code === "B_SENSITIVE_SCAN_UNSCANNABLE")).toHaveLength(2);
  });

  it("detects unlabeled common key and token forms", () => {
    const result = scanSensitiveFiles(new Map([[
      "design/unsafe.md",
      Buffer.from([
        fixtureText("AKIA", "ABCDEFGHIJKLMNOP"),
        fixtureText("sk-", "abcdefghijklmnopqrstuvwxyz"),
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
        fixtureText("-----BEGIN ", "PRIVATE ", "KEY-----"),
      ].join("\n")),
    ]]), {
      policy: { schema_version: 1, exceptions: [] },
      customerName: "星河科技",
      confirmPersonalData: false,
    });
    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "B_SENSITIVE_SECRET",
        "B_SENSITIVE_TOKEN",
      ]),
    );
  });
});
