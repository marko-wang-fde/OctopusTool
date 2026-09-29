import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

async function readYaml(relativePath) {
  return parseYaml(await readFile(path.join(root, relativePath), "utf8"));
}

function expectUnique(values) {
  expect(new Set(values).size).toBe(values.length);
}

describe("public toolkit key catalog", () => {
  it("is a versioned machine fact source with broad, evidenced capabilities", async () => {
    const catalog = await readYaml("catalog/toolkit-keys.yaml");

    expect(catalog.catalog_version).toBeTruthy();
    expect(catalog.source_revision).toBeTruthy();
    expect(Number.isNaN(Date.parse(catalog.verified_at))).toBe(false);
    expect(catalog.fact_scope).toBe("public-machine-source");
    expect(catalog.toolkits.length).toBeGreaterThanOrEqual(20);

    expect(Array.isArray(catalog.sources)).toBe(true);
    expect(catalog.sources.length).toBeGreaterThan(0);
    const sourceIds = catalog.sources.map((source) => source.source_id);
    expectUnique(sourceIds);
    const sourcesById = new Map(
      catalog.sources.map((source) => [source.source_id, source]),
    );
    for (const source of catalog.sources) {
      expect(source.source_id).toMatch(/^[a-z0-9][a-z0-9._-]+$/);
      expect(source.title).toBeTruthy();
      expect(source.title).toMatch(/public|sanitized/i);
      expect(["public", "sanitized"]).toContain(source.classification);
      expect(source.revision || source.sha256).toBeTruthy();
      if (source.sha256 !== undefined) {
        expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      }
      expect(source.locator).toMatch(
        /^catalog\/toolkit-keys\.yaml#sources\.[a-z0-9._-]+$/,
      );
      expect(Object.keys(source.sections).length).toBeGreaterThan(0);
      for (const section of Object.values(source.sections)) {
        expect(section).toBeTruthy();
      }
    }

    const keys = catalog.toolkits.map((item) => item.key);
    expectUnique(keys);
    expect(keys).toContain("feat.arcubase_user");
    expect(keys).toContain("feat.organization_view");

    for (const item of catalog.toolkits) {
      expect(item.key).toMatch(/^feat\.[a-z0-9_]+$/);
      expect(["available", "conditional", "restricted"]).toContain(item.status);
      expect(item.source_version).toBeTruthy();
      expect(item.evidence).toBeTruthy();
      expect(["low", "medium", "high", "critical"]).toContain(item.risk_level);
      expect(sourcesById.has(item.source_id)).toBe(true);
      expect(
        Object.hasOwn(sourcesById.get(item.source_id).sections, item.source_section),
      ).toBe(true);
    }

    expect(JSON.stringify(catalog.sources)).not.toMatch(
      /\/Users\/|file:\/\/|https?:\/\/[^"]*(?:internal|private)/i,
    );
  });
});

describe("assembly operation catalog", () => {
  it("defines only the fixed supported and manual-required operation groups", async () => {
    const catalog = await readYaml("catalog/assembly-operations.yaml");
    const supported = catalog.supported;
    const manual = catalog.manual_required;

    expect(supported.map((item) => item.operation_id)).toEqual([
      "skill.upload",
      "skill.enable-assembly",
      "team-private-digiworker.create",
      "employee.skillsets.set",
      "employee-hire.create",
    ]);
    expect(manual.map((item) => item.operation_id)).toEqual([
      "skill-set.create",
      "skill-package.upload",
      "arcubase-app.create",
      "arcubase-table.create",
    ]);
    expectUnique(
      [...supported, ...manual].map((item) => item.operation_id),
    );
    expect(catalog.blocked).toBeUndefined();
  });

  it("keeps supported operations contract-backed and live-assembly", async () => {
    const catalog = await readYaml("catalog/assembly-operations.yaml");
    const expectedPaths = new Map([
      ["skill.upload", ["configure", "skill", "upload", "add"]],
      [
        "skill.enable-assembly",
        ["configure", "skill", "enable-assembly", "add"],
      ],
      [
        "team-private-digiworker.create",
        ["configure", "team", "private-digiworkers", "add"],
      ],
      [
        "employee.skillsets.set",
        ["configure", "employee", "skillsets", "set"],
      ],
      ["employee-hire.create", ["configure", "employee", "hire"]],
    ]);
    const expectedPositionals = new Map([
      ["skill.enable-assembly", ["<id>"]],
      ["employee.skillsets.set", ["<digi-employee-id>"]],
    ]);

    for (const operation of catalog.supported) {
      expect(operation.executor).toBe("octopus-cli");
      expect(operation.support).toBe("supported");
      expect(operation.command_path).toEqual(
        expectedPaths.get(operation.operation_id),
      );
      expect(operation.positional_args).toEqual(
        expectedPositionals.get(operation.operation_id) ?? [],
      );
      expect(operation.options.output).toBe("--json");
      if (operation.operation_id === "skill.enable-assembly") {
        expect(operation.options).toEqual({ output: "--json" });
        expect(operation.payload_schema_uri).toBeNull();
      } else {
        expect(operation.options).toEqual({
          payload: "--body-file",
          output: "--json",
        });
        expect(operation.payload_schema_uri).toMatch(
          /^schemas\/payloads\/[a-z0-9-]+\.schema\.json$/,
        );
      }
      expect(operation.risk_level).toBe("high");
      expect(operation.contract_version).toBeTruthy();
      expect(operation.cli_evidence_rule).toBeTruthy();
      expect(operation.execution_policy).toBe("live-assembly");
    }
  });

  it("uses the real read-only auth identity probe to bind profile and team", async () => {
    const catalog = await readYaml("catalog/assembly-operations.yaml");
    expect(catalog.context_probe).toMatchObject({
      operation_id: "auth.whoami",
      command_path: ["auth", "whoami"],
      options: {
        profile: "--profile",
        output: "--json",
      },
      output_contract: {
        format: "json",
        profile_path: ["profile"],
        team_path: ["team", "id"],
      },
      explicit_context_argv: null,
    });
  });

  it("keeps unsupported writes honestly manual without fake CLI fields", async () => {
    const catalog = await readYaml("catalog/assembly-operations.yaml");
    const forbidden = [
      "command_path",
      "positional_args",
      "options",
      "payload_file",
      "payload_schema_uri",
      "contract_version",
      "cli_evidence_rule",
      "execution_policy",
    ];

    for (const operation of catalog.manual_required) {
      expect(operation.executor).toBe("admin-manual");
      expect(operation.support).toBe("manual-required");
      for (const field of forbidden) expect(operation).not.toHaveProperty(field);
      expect(operation.manual_artifacts.length).toBeGreaterThan(0);
      expect(operation.manual_instructions.length).toBeGreaterThan(0);
      expect(operation.recovery_condition).toBeTruthy();
      expect(operation.verification_condition).toBeTruthy();
    }
  });

  it("uses only registered, resolvable project artifact paths", async () => {
    const catalog = await readYaml("catalog/assembly-operations.yaml");
    const artifacts = catalog.manual_required.flatMap(
      (operation) => operation.manual_artifacts,
    );
    const allowedArtifacts = new Set([
      "skills/<skill-slug>/",
      "arcubase/decision.yaml",
      "arcubase/schema.yaml",
      "arcubase/access-matrix.md",
      "acceptance/test-cases.yaml",
    ]);

    expect(catalog.artifact_variables).toBeTruthy();
    for (const artifact of artifacts) {
      expect(allowedArtifacts.has(artifact), `orphan artifact ${artifact}`).toBe(
        true,
      );
      for (const match of artifact.matchAll(/<[^>]+>/g)) {
        expect(catalog.artifact_variables).toHaveProperty(match[0]);
      }
    }
    expect(artifacts).not.toContain("assembly/skill-package-manifest.yaml");
    expect(catalog.artifact_variables).toEqual({
      "<skill-slug>": {
        source: "fde-project.yaml#skills[].id",
        transform: "strip-skill-prefix-and-kebab-case",
        cardinality: "one-per-approved-skill",
        expansion: "expand-once-per-approved-skill",
      },
    });
  });
});

describe("stage artifact catalog", () => {
  it("uses only the reusable report as authoritative validate output", async () => {
    const catalog = await readYaml("catalog/stage-artifacts.yaml");
    const validate = catalog.stages.find(({ id }) => id === "validate");
    expect(validate.required_outputs).toEqual([
      "reports/package-validation.json",
    ]);
  });
});

describe("license", () => {
  it("uses the Apache License 2.0 text", async () => {
    const license = await readFile(path.join(root, "LICENSE"), "utf8");
    expect(license).toContain("Apache License");
    expect(license).toContain("Version 2.0, January 2004");
    expect(license).toContain("http://www.apache.org/licenses/");
    expect(license).toContain("END OF TERMS AND CONDITIONS");
  });
});
