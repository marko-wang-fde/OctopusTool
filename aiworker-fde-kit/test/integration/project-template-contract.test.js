import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, test } from "vitest";

import { parseSafeYaml } from "../../src/contracts/safe-data.js";
import {
  SCHEMA_IDS,
  createOfficialSchemaRegistry,
  validateSchema,
} from "../../src/contracts/schema-registry.js";
import { sortRelativePaths } from "../../src/shared/canonical.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_ROOT = path.join(ROOT, "assets/project-template");

const FIXED = [
  ".gitignore",
  "fde-project.yaml",
  "inputs/input-inventory.md",
  "discovery/facts-and-assumptions.md",
  "discovery/open-questions.md",
  "discovery/scenario-model.md",
  "design/team-design.md",
  "design/collaboration-and-dataflow.md",
  "design/platform-capability-selection.md",
  "design/data-foundation.md",
  "design/identity-and-access.md",
  "arcubase/decision.yaml",
  "assembly/assembly-plan.md",
  "assembly/operations.yaml",
  "acceptance/acceptance-plan.md",
  "acceptance/test-cases.yaml",
  "reports/validation-report.md",
  "delivery-summary.md",
];

const CONDITIONAL = {
  "external-station": {
    trigger: "workers[].station_reachable == true",
    source: "design/external-station.md",
    target: "design/external-station.md",
  },
  taskboard: {
    trigger: "capabilities[] contains feat.taskboard",
    source: "design/taskboard.md",
    target: "design/taskboard.md",
  },
  "browser-webskill": {
    trigger: "capabilities[] contains browser-or-webskill",
    source: "design/browser-webskill.md",
    target: "design/browser-webskill.md",
  },
};

async function readYaml(relativePath) {
  const text = await readFile(path.join(TEMPLATE_ROOT, relativePath), "utf8");
  return parseSafeYaml(text, relativePath);
}

let inventory;
let registry;

beforeAll(async () => {
  inventory = await readYaml("template-inventory.yaml");
  registry = await createOfficialSchemaRegistry();
});

describe("project template inventory", () => {
  test("declares the exact fixed skeleton and conditional trigger matrix", () => {
    expect(inventory).toEqual({
      schema_version: 1,
      fixed: FIXED,
      conditional: CONDITIONAL,
    });
  });

  test("contains only unique safe regular-file sources that exist", async () => {
    const paths = [
      ...inventory.fixed,
      ...Object.values(inventory.conditional).map(({ source }) => source),
    ];
    expect(sortRelativePaths(paths)).toHaveLength(new Set(paths).size);

    for (const relativePath of paths) {
      const absolutePath = path.join(TEMPLATE_ROOT, relativePath);
      expect(path.relative(TEMPLATE_ROOT, absolutePath)).not.toMatch(
        /^\.\.(?:\/|$)/u,
      );
      expect((await lstat(absolutePath)).isFile()).toBe(true);
      expect((await lstat(absolutePath)).isSymbolicLink()).toBe(false);
    }
  });
});

describe("structured template defaults", () => {
  test.each([
    ["fde-project.yaml", SCHEMA_IDS.project],
    ["arcubase/decision.yaml", SCHEMA_IDS.arcubase],
    ["assembly/operations.yaml", SCHEMA_IDS.assembly],
  ])("validates %s against its public schema", async (relativePath, schemaId) => {
    const value = await readYaml(relativePath);
    expect(validateSchema(registry, schemaId, value)).toEqual({
      valid: true,
      errors: [],
    });
  });

  test("validates the strict acceptance case document shape and every embedded case", async () => {
    const value = await readYaml("acceptance/test-cases.yaml");
    expect(Object.keys(value).sort()).toEqual(["cases", "schema_version"]);
    expect(value.schema_version).toBe(1);
    expect(
      validateSchema(
        registry,
        `${SCHEMA_IDS.project}#/$defs/acceptanceCaseDocument`,
        value,
      ),
    ).toEqual({ valid: true, errors: [] });
  });

  test("safely parses every YAML template", async () => {
    const yamlPaths = [
      "template-inventory.yaml",
      ...inventory.fixed.filter((file) => file.endsWith(".yaml")),
    ];
    for (const relativePath of yamlPaths) {
      expect(await readYaml(relativePath)).toBeDefined();
    }
  });
});

describe("human-readable templates", () => {
  test("keeps every Markdown template meaningful and free of unresolved or sensitive content", async () => {
    const markdownPaths = [
      ...inventory.fixed,
      ...Object.values(inventory.conditional).map(({ source }) => source),
    ].filter((file) => file.endsWith(".md"));

    for (const relativePath of markdownPaths) {
      const text = await readFile(path.join(TEMPLATE_ROOT, relativePath), "utf8");
      expect(text.trim().length, relativePath).toBeGreaterThan(80);
      expect(text, relativePath).toMatch(/^# .+/mu);
      expect(text, relativePath).not.toMatch(
        /\{\{|\}\}|\$\{|TODO|TBD|星河|张楠|陈晨|138\d{8}|\/Users\/|[A-Za-z]:\\/u,
      );
    }
  });

  test.each(Object.values(CONDITIONAL).map(({ source, trigger }) => [source, trigger]))(
    "%s documents trigger facts, design, identity risks, and acceptance for %s",
    async (source) => {
      const text = await readFile(path.join(TEMPLATE_ROOT, source), "utf8");
      expect(text).toMatch(/触发事实/u);
      expect(text).toMatch(/设计/u);
      expect(text).toMatch(/身份与权限风险/u);
      expect(text).toMatch(/验收/u);
    },
  );

  test("ignores source material, backups, temporary files, secrets, generated evidence, and delivery archives", async () => {
    const entries = (
      await readFile(path.join(TEMPLATE_ROOT, ".gitignore"), "utf8")
    )
      .split(/\r?\n/u)
      .filter(Boolean);
    expect(entries).toEqual(
      expect.arrayContaining([
        "inputs/source-files/",
        "reports/backups/",
        ".tmp/",
        ".env*",
        "generated/",
        "delivery/*.zip",
      ]),
    );
  });
});
