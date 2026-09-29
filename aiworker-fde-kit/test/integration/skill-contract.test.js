import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function splitFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  expect(match, "SKILL.md must have YAML frontmatter").not.toBeNull();
  return { metadata: parseYaml(match[1]), body: match[2] };
}

function markdownLinks(markdown) {
  return [...markdown.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)]
    .map((match) => match[1].split(/[?#]/, 1)[0])
    .filter(
      (target) =>
        target &&
        !target.startsWith("#") &&
        !target.startsWith("/") &&
        !/^[a-z][a-z0-9+.-]*:/i.test(target),
    );
}

const coreReferences = [
  "references/fde-methodology.md",
  "references/platform-capabilities.md",
  "references/worker-model.md",
  "references/skill-authoring.md",
  "references/arcubase-design.md",
  "references/identity-and-access.md",
  "references/octopus-cli.md",
  "references/acceptance.md",
];

const conditionalReferences = [
  "references/conditional-topics/taskboard.md",
  "references/conditional-topics/browser-and-webskill.md",
  "references/conditional-topics/ontos.md",
  "references/conditional-topics/a2ui.md",
  "references/conditional-topics/external-station.md",
  "references/conditional-topics/private-service.md",
];

const references = [...coreReferences, ...conditionalReferences];

describe("root Skill contract", () => {
  it("uses trigger-only frontmatter for the three supported contexts", async () => {
    const { metadata } = splitFrontmatter(await read("SKILL.md"));

    expect(Object.keys(metadata)).toEqual(["name", "description"]);
    expect(metadata.name).toBe("design-aiworker-solutions");
    expect(metadata.description).toMatch(/^Use when\b/);
    expect(metadata.description).toMatch(/designing .*digital employee.*team/i);
    expect(metadata.description).toMatch(/validated delivery packages/i);
    expect(metadata.description).toMatch(/octopus-cli assembly/i);
    expect(metadata.description).toMatch(/resuming .*FDE project/i);
    expect(metadata.description).not.toMatch(
      /initialize.*discover.*team-design|seven stages|four gates/i,
    );
  });

  it("orchestrates all entry modes, stages, gates, and safety boundaries", async () => {
    const { body } = splitFrontmatter(await read("SKILL.md"));

    for (const mode of ["new", "materials", "resume"]) {
      expect(body).toContain(`\`${mode}\``);
    }
    expect(body).toMatch(/project display name/i);
    expect(body).toMatch(/ASCII (?:directory )?slug/i);
    expect(body).toMatch(/absolute (?:target )?path/i);
    expect(body).toMatch(/propose[\s\S]{0,240}confirm/i);

    const stages = [
      "initialize",
      "discover",
      "team-design",
      "foundation-design",
      "author",
      "assemble",
      "validate",
    ];
    let previous = -1;
    for (const stage of stages) {
      const index = body.indexOf(`\`${stage}\``);
      expect(index, `missing stage ${stage}`).toBeGreaterThan(previous);
      previous = index;
      const stageSection = body.slice(index, index + 900);
      expect(stageSection, `${stage} must route to a reference`).toMatch(
        /\]\(references\//,
      );
    }

    for (const gate of [
      "project creation",
      "requirements baseline",
      "solution baseline",
      "delivery readiness",
      "live assembly",
    ]) {
      expect(body.toLowerCase()).toContain(gate);
    }

    expect(body).toMatch(/validated FDE delivery package/i);
    expect(body).toMatch(/Profile[\s\S]{0,120}Team[\s\S]{0,120}package hash/i);
    expect(body).toMatch(/direct `octopus-cli` assembly/i);
    expect(body).toMatch(/only (?:the )?renderer[\s\S]{0,100}Bash/i);
    expect(body).toMatch(/run_octopus_assemble/i);
    expect(body).toMatch(/never infer[\s\S]{0,180}--help-json/i);
    expect(body).toMatch(/CLI is missing[\s\S]{0,180}(?:do not|never) auto-install/i);
    expect(body).toMatch(/Skill (?:package )?upload[\s\S]{0,180}manual-required/i);
    expect(body).toMatch(
      /Arcubase (?:app\/table|app or table|app and table)[\s\S]{0,180}manual-required/i,
    );
    expect(body.split("\n").length).toBeLessThan(500);
    expect((body.match(/feat\.[a-z0-9_]+/g) ?? []).length).toBeLessThanOrEqual(2);
    expect(body).not.toMatch(/\|\s*(?:option|flag)\s*\|/i);
  });

  it("defines meaningful input and output contracts inside every stage", async () => {
    const { body } = splitFrontmatter(await read("SKILL.md"));
    const contracts = [
      {
        stage: "initialize",
        input: [
          /confirmed .*project display name/i,
          /ASCII .*slug/i,
          /absolute .*path/i,
          /entry mode/i,
          /`new`.*user request.*conversation requirement/i,
          /`materials`.*selected source files/i,
          /`resume`.*existing project directory/i,
          /fde-project\.yaml.*when present/i,
          /import-proposal path.*manifest is missing/i,
        ],
        output: [
          /manifest/i,
          /skeleton/i,
          /source inventory with recorded portability state/i,
        ],
      },
      {
        stage: "discover",
        input: [/manifest/i, /user request|source inventory/i],
        output: [/facts/i, /assumptions/i, /questions/i, /scenario/i],
      },
      {
        stage: "team-design",
        input: [/confirmed discovery baseline/i],
        output: [/team/i, /workflow/i, /capabilit/i, /identity/i, /baseline/i],
      },
      {
        stage: "foundation-design",
        input: [
          /confirmed discovery\/requirements baseline/i,
          /team/i,
          /workflow/i,
          /business objects/i,
          /capability proposal/i,
          /identity constraints/i,
        ],
        output: [
          /Arcubase decision/i,
          /schema/i,
          /access design/i,
          /finalized capability/i,
          /identity design/i,
        ],
      },
      {
        stage: "author",
        input: [
          /solution-baseline-approved/i,
          /worker contracts/i,
          /Skill contracts/i,
          /capability contracts/i,
          /data contracts/i,
        ],
        output: [/employee definitions/i, /self-contained Skill/i],
      },
      {
        stage: "assemble",
        input: [
          /approved artifacts/i,
          /versioned operation catalog/i,
          /CLI evidence/i,
        ],
        output: [
          /operations/i,
          /payloads/i,
          /manual steps/i,
          /optional .*assembly script/i,
          /acceptance/i,
        ],
      },
      {
        stage: "validate",
        input: [/full project/i, /assembly evidence/i, /package policy/i],
        output: [
          /validation report/i,
          /package manifest/i,
          /validated package/i,
          /readiness summary/i,
        ],
      },
    ];

    for (const contract of contracts) {
      const escapedStage = contract.stage.replaceAll("-", "\\-");
      const section = body.match(
        new RegExp(
          `^### \\d+\\. \`${escapedStage}\`\\n([\\s\\S]*?)(?=^### \\d+\\. \`|^## )`,
          "m",
        ),
      )?.[1];
      expect(section, `missing section for ${contract.stage}`).toBeTruthy();

      const input = section.match(/^Input:\s*(\S.*)$/m)?.[1];
      const output = section.match(/^Output:\s*(\S.*)$/m)?.[1];
      expect(input, `${contract.stage} needs a nonempty Input`).toBeTruthy();
      expect(output, `${contract.stage} needs a nonempty Output`).toBeTruthy();
      for (const pattern of contract.input) {
        expect(input, `${contract.stage} Input must match ${pattern}`).toMatch(
          pattern,
        );
      }
      for (const pattern of contract.output) {
        expect(output, `${contract.stage} Output must match ${pattern}`).toMatch(
          pattern,
        );
      }
    }
  });

  it("places the solution baseline after foundation design and before authoring", async () => {
    const { body } = splitFrontmatter(await read("SKILL.md"));
    const foundationHeading = "### 4. `foundation-design`";
    const authorHeading = "### 5. `author`";
    const gateMarker = "**Solution baseline gate:**";
    const foundationStart = body.indexOf(foundationHeading);
    const authorStart = body.indexOf(authorHeading);
    const gateStart = body.indexOf(gateMarker);
    const foundationSection = body.slice(foundationStart, authorStart);
    const foundationInput = foundationSection.match(
      /^Input:\s*(\S.*)$/m,
    )?.[1];
    const gateText = body.slice(gateStart, authorStart);

    expect(foundationStart).toBeGreaterThanOrEqual(0);
    expect(authorStart).toBeGreaterThan(foundationStart);
    expect(foundationInput).toBeTruthy();
    expect(foundationInput).not.toMatch(
      /solution baseline|approved solution/i,
    );
    expect(gateStart).toBeGreaterThan(foundationStart);
    expect(gateStart).toBeLessThan(authorStart);
    for (const expected of [
      /worker count/i,
      /responsibilit/i,
      /workflow/i,
      /data foundation/i,
      /capabilit/i,
      /identity/i,
      /permissions/i,
      /human-in-the-loop/i,
    ]) {
      expect(gateText).toMatch(expected);
    }
  });

  it("defines only the four derived project statuses precisely", async () => {
    const { body } = splitFrontmatter(await read("SKILL.md"));
    const section = body.match(
      /^## Project statuses\n([\s\S]*?)(?=^## )/m,
    )?.[1];

    expect(section).toBeTruthy();
    expect(body).not.toMatch(/`(?:designing|validating)`/u);
    for (const status of [
      "draft",
      "reviewable",
      "delivery-ready",
      "cli-assembled",
    ]) {
      expect(section).toContain(`\`${status}\``);
    }
    expect(section).toMatch(
      /`draft`[\s\S]{0,320}first three[\s\S]{0,180}(?:not `complete`|`BLOCKER`)/iu,
    );
    expect(section).toMatch(
      /`reviewable`[\s\S]{0,420}first three[\s\S]{0,200}`complete`[\s\S]{0,240}(?:later four|remaining four)[\s\S]{0,220}(?:not `complete`|`BLOCKER`)/iu,
    );
    expect(section).toMatch(
      /`delivery-ready`[\s\S]{0,360}(?:all seven|seven stages)[\s\S]{0,160}`complete`[\s\S]{0,180}zero[\s\S]{0,40}`BLOCKER`[\s\S]{0,240}(?:scan|manifest)/iu,
    );
    expect(section).toMatch(
      /`cli-assembled`[\s\S]{0,620}`delivery-ready`[\s\S]{0,220}supported write[\s\S]{0,220}artifact hash[\s\S]{0,220}Profile[\s\S]{0,100}Team[\s\S]{0,260}direct `octopus-cli` assembly/iu,
    );
    expect(section).toMatch(
      /does not (?:mean|prove)[\s\S]{0,160}(?:production|platform acceptance)/iu,
    );
  });

  it("provides direct, valid reference links", async () => {
    const skill = await read("SKILL.md");
    for (const reference of references) {
      expect(skill).toContain(`](${reference})`);
    }

    for (const relativeTarget of markdownLinks(skill)) {
      await expect(stat(path.resolve(root, relativeTarget))).resolves.toBeTruthy();
    }
  });

  it("requires unconditional specialist follow-up for unsupported V1 topics", async () => {
    const { body } = splitFrontmatter(await read("SKILL.md"));
    const conditionalBlock = body.match(
      /^## Load conditional topics directly\n([\s\S]*?)(?=^## )/m,
    )?.[1];

    expect(conditionalBlock).toMatch(
      /Ontos, A2UI, (?:and|or) Private Service[\s\S]*selected in V1/i,
    );
    expect(conditionalBlock).toMatch(/always[\s\S]*WARNING/i);
    expect(conditionalBlock).toMatch(/specialist follow-up/i);
    expect(conditionalBlock).toMatch(
      /(?:never|do not) claim full specialized coverage/i,
    );
  });
});

describe("Skill UI metadata and references", () => {
  it("has a minimal quoted OpenAI interface", async () => {
    const source = await read("agents/openai.yaml");
    const parsed = parseYaml(source);

    expect(Object.keys(parsed)).toEqual(["interface"]);
    expect(Object.keys(parsed.interface)).toEqual([
      "display_name",
      "short_description",
      "default_prompt",
    ]);
    expect(parsed.interface.display_name).toBe("AIWorker FDE Kit");
    expect(parsed.interface.short_description.length).toBeGreaterThanOrEqual(25);
    expect(parsed.interface.short_description.length).toBeLessThanOrEqual(64);
    expect(parsed.interface.short_description.length).toBeLessThanOrEqual(80);
    expect(parsed.interface.default_prompt).toContain(
      "$design-aiworker-solutions",
    );
    for (const key of Object.keys(parsed.interface)) {
      expect(source).toMatch(new RegExp(`^  ${key}: ["'].*["']$`, "m"));
    }
  });

  it.each(references)("%s is versioned, sourced, and navigable", async (file) => {
    const source = await read(file);
    const lines = source.split("\n");

    expect(source).toMatch(/^Updated: \d{4}-\d{2}-\d{2}$/m);
    expect(source).toMatch(/^Applicable version: .+$/m);
    expect(source).toMatch(/^Source: .*(?:public|sanitized).+$/im);
    if (lines.length > 100) {
      expect(lines.slice(0, 30).join("\n")).toMatch(
        /table of contents|目录/i,
      );
    }

    for (const relativeTarget of markdownLinks(source)) {
      await expect(
        stat(path.resolve(root, path.dirname(file), relativeTarget)),
      ).resolves.toBeTruthy();
    }
  });

  it.each(conditionalReferences)(
    "%s has the complete conditional-topic contract",
    async (file) => {
      const source = await read(file);
      let previous = -1;
      for (const heading of [
        "## Trigger",
        "## Required design questions",
        "## Deliverable impact",
        "## Identity and permission risks",
        "## Exit check",
      ]) {
        const index = source.indexOf(heading);
        expect(index, `${file} missing ${heading}`).toBeGreaterThan(previous);
        previous = index;
      }
    },
  );

  it.each([
    "references/conditional-topics/ontos.md",
    "references/conditional-topics/a2ui.md",
    "references/conditional-topics/private-service.md",
  ])("%s requires V1 warning and specialist follow-up whenever selected", async (file) => {
    const source = await read(file);

    expect(source).toMatch(/WARNING/);
    expect(source).toMatch(
      /V1 (?:has no|lacks) (?:a )?dedicated template (?:or|and) validator/i,
    );
    expect(source).toMatch(/whenever selected|selection always requires/i);
    expect(source).toMatch(/specialist follow-up/i);
    expect(source).toMatch(/(?:do not|never) claim full specialized coverage/i);
  });

  it("documents copied and reference-only source portability", async () => {
    const methodology = await read("references/fde-methodology.md");

    expect(methodology).toMatch(
      /default[\s\S]{0,120}copy[\s\S]{0,120}`inputs\/source-files\/`/i,
    );
    for (const field of [
      /original path/i,
      /SHA-256/i,
      /media type/i,
      /read status/i,
      /copy time/i,
    ]) {
      expect(methodology).toMatch(field);
    }
    expect(methodology).toMatch(/reference-only/i);
    expect(methodology).toMatch(/`portable:\s*false`/i);
    expect(methodology).toMatch(
      /disclose[\s\S]{0,100}(?:package|delivery)[\s\S]{0,100}implications/i,
    );
  });
});
