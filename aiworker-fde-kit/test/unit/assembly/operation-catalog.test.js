import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildCommandIndex,
  evaluateOperationCatalog,
  loadOperationCatalog,
} from "../../../src/assembly/operation-catalog.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const CATALOG = path.join(ROOT, "catalog/assembly-operations.yaml");

function command(...segments) {
  return { name: segments.at(-1), path: segments };
}

function operationHelp(operation, optionLines = null, positionals = null) {
  const positionalText = (positionals ?? operation.positional_args ?? [])
    .map((value) => ` ${value}`)
    .join("");
  const options = optionLines ?? [
    ...(operation.options?.payload ? ["--body-file <path>"] : []),
    ...(operation.options?.output ? ["--json"] : []),
    "--help",
  ].join("\n");
  return `Usage: octopus-cli ${operation.command_path.join(" ")}${positionalText} [options]\n` +
    `Options:\n${options}\n`;
}

function byId(catalog, operationId) {
  const operation = catalog.supported.find((item) =>
    item.operation_id === operationId);
  if (!operation) throw new Error(`missing catalog operation: ${operationId}`);
  return operation;
}

describe("assembly operation catalog inspection", () => {
  it("indexes the captured octopus-cli 0.1.1 top-level array shape", async () => {
    const captured = JSON.parse(await readFile(path.join(
      ROOT,
      "test/fixtures/cli/octopus-cli-0.1.1-help-json.json",
    ), "utf8"));

    const index = buildCommandIndex(captured);

    expect(captured).toHaveLength(5);
    expect(index.commands).toEqual(expect.arrayContaining([
      { path: ["auth", "login"], path_text: "auth login" },
      { path: ["task", "create"], path_text: "task create" },
      {
        path: ["conversation", "send"],
        path_text: "conversation send",
      },
      { path: ["skills", "sync"], path_text: "skills sync" },
      {
        path: ["configure", "team", "use"],
        path_text: "configure team use",
      },
    ]));
  });

  it("strictly validates every node in a top-level help array", () => {
    expect(() => buildCommandIndex([
      { name: "valid", commands: [] },
      { name: "invalid", commands: [null] },
    ])).toThrow(expect.objectContaining({
      code: "E_CLI_HELP_CONTRACT",
    }));
  });

  it.each([
    42,
    {},
    { commands: "invalid" },
    { commands: [null] },
    { commands: [{ name: 42 }] },
    { commands: [{ name: "safe", path: [".."] }] },
    { commands: [{ name: "safe", path: 42 }] },
    { commands: [{ name: "safe", options: "invalid" }] },
    { commands: [{ name: "safe", options: [null] }] },
    { commands: [{ name: "safe", options: [{ flags: 42 }] }] },
    { commands: [{ name: "safe", children: "invalid" }] },
    { commands: [{ name: "safe", children: [42] }] },
  ])("rejects malformed help-json semantic structure: %#", (help) => {
    expect(() => buildCommandIndex(help)).toThrow(
      expect.objectContaining({ code: "E_CLI_HELP_CONTRACT" }),
    );
  });

  it("loads the versioned catalog without changing its supported contracts", async () => {
    const catalog = await loadOperationCatalog(CATALOG);

    expect(catalog.catalog_version).toBe("1.0.4");
    expect(catalog.supported.map(({ operation_id }) => operation_id)).toEqual([
      "skill.upload",
      "skill.enable-assembly",
      "team-private-digiworker.create",
      "employee.skillsets.set",
      "employee-hire.create",
    ]);
    expect(catalog.manual_required.map(({ operation_id }) => operation_id))
      .toEqual([
        "skill-set.create",
        "skill-package.upload",
        "arcubase-app.create",
        "arcubase-table.create",
      ]);
    const bodyFileOperations = catalog.supported.filter((operation) =>
      operation.options.payload === "--body-file");
    for (const operation of bodyFileOperations) {
      expect(operation.manual_fallback).toMatchObject({
        executor: "admin-manual",
        manual_artifacts: expect.any(Array),
        manual_instructions: expect.any(Array),
      });
      expect(operation.option_shape).toEqual({
        payload: {
          arity: "value",
          required: true,
          allowed_forms: ["separate"],
        },
        output: {
          arity: "boolean",
          required: true,
          allowed_forms: ["standalone"],
        },
      });
      expect(operation.execution_policy).toBe("live-assembly");
    }
    expect(catalog.supported.find(({ operation_id }) =>
      operation_id === "skill.enable-assembly")).toMatchObject({
      positional_args: ["<id>"],
      options: { output: "--json" },
      output_contract: {
        skill_id_paths: [["data", "skillId"], ["skillId"]],
        skillset_id_paths: [["data", "skillsetId"], ["skillsetId"]],
      },
    });
  });

  it("indexes command paths only and does not invent options, payloads, or toolkit keys", () => {
    const index = buildCommandIndex({
      name: "octopus-cli",
      commands: [
        {
          name: "configure",
          commands: [
            {
              name: "skill",
              commands: [
                { name: "set", commands: [{ name: "add" }] },
              ],
            },
          ],
        },
      ],
    });

    expect(index.commands).toEqual([
      { path: ["configure", "skill", "set", "add"], path_text: "configure skill set add" },
    ]);
    expect(JSON.stringify(index)).not.toMatch(
      /options|payload|toolkit|body-file|dryrun/iu,
    );
  });

  it("normalizes an explicit help path without retaining the CLI program name", () => {
    const index = buildCommandIndex({
      commands: [{
        name: "configure",
        path: ["octopus-cli", "configure"],
        commands: [{
          name: "skill",
          commands: [{
            name: "set",
            commands: [{ name: "add" }],
          }],
        }],
      }],
    });

    expect(index.commands).toEqual([{
      path: ["configure", "skill", "set", "add"],
      path_text: "configure skill set add",
    }]);
  });

  it("marks matching contract paths and leaf option shapes supported", async () => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: [
        command("configure", "team", "private-digiworkers", "add"),
        command("configure", "skill", "upload", "add"),
        command("configure", "skill", "enable-assembly", "add"),
        command("configure", "employee", "skillsets", "set"),
        command("configure", "employee", "hire"),
      ],
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      operationHelp(operation),
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.issues).toEqual([]);
    expect(evaluated.operations.map(({ status }) => status)).toEqual([
      "supported",
      "supported",
      "supported",
      "supported",
      "supported",
      "manual-required",
      "manual-required",
      "manual-required",
      "manual-required",
    ]);
  });

  it("does not require an optional option when it is absent from leaf help", async () => {
    const loaded = await loadOperationCatalog(CATALOG);
    const catalog = structuredClone(loaded);
    byId(catalog, "team-private-digiworker.create")
      .option_shape.payload.required = false;
    const index = buildCommandIndex({
      commands: catalog.supported.map(({ command_path }) =>
        command(...command_path)),
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      `Usage: octopus-cli ${operation.command_path.join(" ")}${(operation.positional_args ?? []).map((value) => ` ${value}`).join("")} [options]\n` +
        (operation.operation_id === "team-private-digiworker.create"
          ? "--json\n"
          : [
            ...(operation.options?.payload ? ["--body-file <path>"] : []),
            "--json",
          ].join("\n") + "\n"),
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations[0].status).toBe("supported");
    expect(evaluated.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_CONTRACT_CONFLICT",
      path: "configure skill set add",
    }));
  });

  it("still validates the shape of an optional option when it is present", async () => {
    const loaded = await loadOperationCatalog(CATALOG);
    const catalog = structuredClone(loaded);
    byId(catalog, "team-private-digiworker.create")
      .option_shape.payload.required = false;
    const index = buildCommandIndex({
      commands: catalog.supported.map(({ command_path }) =>
        command(...command_path)),
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      `Usage: octopus-cli ${operation.command_path.join(" ")}${(operation.positional_args ?? []).map((value) => ` ${value}`).join("")} [options]\n` +
        (operation.operation_id === "team-private-digiworker.create"
          ? "--body-file\n--json\n"
          : [
            ...(operation.options?.payload ? ["--body-file <path>"] : []),
            "--json",
          ].join("\n") + "\n"),
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "team-private-digiworker.create").status).toBe("blocked");
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_CONTRACT_CONFLICT",
      details: expect.objectContaining({
        option_conflicts: expect.arrayContaining([
          expect.objectContaining({
            semantic: "payload",
            reason: "value-required",
          }),
        ]),
      }),
    }));
  });

  it.each([
    [""],
    [" "],
    ["."],
    [".."],
    ["a/b"],
    ["a\\b"],
    ["-x"],
    ["--help"],
    ["a--b"],
    ["a\u0000b"],
    ["a\u001fb"],
    ["%2e%2e"],
  ])("rejects an unsafe catalog command token: %#", async (token) => {
    const loaded = await loadOperationCatalog(CATALOG);
    const catalog = structuredClone(loaded);
    catalog.supported[0].command_path[0] = token;

    expect(() => evaluateOperationCatalog(
      catalog,
      { commands: [] },
      new Map(),
    )).toThrow(expect.objectContaining({
      code: "E_OPERATION_CATALOG_INVALID",
    }));
  });

  it("rejects duplicate canonical command paths", async () => {
    const loaded = await loadOperationCatalog(CATALOG);
    const catalog = structuredClone(loaded);
    catalog.supported[1].command_path = [
      ...catalog.supported[0].command_path,
    ];

    expect(() => evaluateOperationCatalog(
      catalog,
      { commands: [] },
      new Map(),
    )).toThrow(expect.objectContaining({
      code: "E_OPERATION_CATALOG_INVALID",
    }));
  });

  it("rejects command paths whose fixture leaf slugs collide", async () => {
    const loaded = await loadOperationCatalog(CATALOG);
    const catalog = structuredClone(loaded);
    catalog.supported[0].command_path = ["a-b", "c"];
    catalog.supported[1].command_path = ["a", "b-c"];

    expect(() => evaluateOperationCatalog(
      catalog,
      { commands: [] },
      new Map(),
    )).toThrow(expect.objectContaining({
      code: "E_OPERATION_CATALOG_INVALID",
    }));
  });

  it("keeps explicit and fallback manual paths manual-required when no CLI command exists", async () => {
    const catalog = await loadOperationCatalog(CATALOG);
    const evaluated = evaluateOperationCatalog(
      catalog,
      buildCommandIndex({ commands: [] }),
      new Map(),
    );

    expect(evaluated.operations.filter(({ status }) =>
      status === "manual-required").map(({ operation_id }) => operation_id)
    ).toEqual([
      "skill.upload",
      "skill.enable-assembly",
      "team-private-digiworker.create",
      "employee.skillsets.set",
      "employee-hire.create",
      "skill-set.create",
      "skill-package.upload",
      "arcubase-app.create",
      "arcubase-table.create",
    ]);
  });

  it("uses an explicitly linked same-operation manual fallback when its command is missing", async () => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: [
        command("skill", "set", "create"),
        command("team", "private-digiworkers", "create"),
      ],
    });
    const leafHelp = new Map(catalog.supported.slice(0, 2).map((operation) => [
      operation.operation_id,
      `Usage: octopus-cli ${operation.command_path.join(" ")} [options]\n` +
        "--body-file <path>\n--json\n--dryrun\n",
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "employee-hire.create")).toMatchObject({
        status: "manual-required",
        evidence: {
          command_present: false,
          fallback_executor: "admin-manual",
        },
      });
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      severity: "WARNING",
      code: "W_CLI_COMMAND_MANUAL_FALLBACK",
      path: "configure employee hire",
    }));
  });

  it("blocks a missing command when that operation has no manual fallback", async () => {
    const loaded = await loadOperationCatalog(CATALOG);
    const catalog = structuredClone(loaded);
    delete byId(catalog, "employee-hire.create").manual_fallback;
    const index = buildCommandIndex({
      commands: [
        command("skill", "set", "create"),
        command("team", "private-digiworkers", "create"),
      ],
    });
    const leafHelp = new Map(catalog.supported.slice(0, 2).map((operation) => [
      operation.operation_id,
      `Usage: octopus-cli ${operation.command_path.join(" ")} [options]\n` +
        "--body-file <path>\n--json\n--dryrun\n",
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "employee-hire.create").status).toBe("blocked");
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      severity: "BLOCKER",
      code: "B_CLI_COMMAND_MISSING",
    }));
  });

  it("warns about unregistered write leaves without promoting them", async () => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: [command("worker", "delete")],
    });

    const evaluated = evaluateOperationCatalog(catalog, index, new Map());

    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      severity: "WARNING",
      code: "W_CLI_UNCATALOGED_WRITE",
      path: "worker delete",
    }));
    expect(evaluated.operations).not.toContainEqual(
      expect.objectContaining({ command_path: ["worker", "delete"] }),
    );
  });

  it.each([
    ["access grant"],
    ["role assign"],
    ["dataset import"],
    ["record archive"],
  ])("conservatively warns about uncataloged write semantics: %s", async (text) => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: [command(...text.split(" "))],
    });

    const evaluated = evaluateOperationCatalog(catalog, index, new Map());

    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      severity: "WARNING",
      code: "W_CLI_UNCATALOGED_WRITE",
      path: text,
    }));
  });

  it.each([
    ["access list"],
    ["employee get"],
    ["team describe"],
    ["records search"],
  ])("does not warn for an explicitly read-only uncataloged leaf: %s", async (text) => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: [command(...text.split(" "))],
    });

    const evaluated = evaluateOperationCatalog(catalog, index, new Map());

    expect(evaluated.issues).not.toContainEqual(expect.objectContaining({
      code: "W_CLI_UNCATALOGED_WRITE",
      path: text,
    }));
  });

  it("blocks a leaf-help parameter shape conflict", async () => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: catalog.supported.map(({ command_path }) =>
        command(...command_path)),
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      operationHelp(
        operation,
        operation.operation_id === "team-private-digiworker.create"
          ? "--body <json>\n--json"
          : null,
      ),
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "team-private-digiworker.create").status).toBe("blocked");
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      severity: "BLOCKER",
      code: "B_CLI_CONTRACT_CONFLICT",
      path: "configure team private-digiworkers add",
    }));
  });

  it("blocks an unexpected positional argument even when required options exist", async () => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: catalog.supported.map(({ command_path }) =>
        command(...command_path)),
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      operationHelp(
        operation,
        null,
        operation.operation_id === "team-private-digiworker.create"
          ? ["<name>"]
          : null,
      ),
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "team-private-digiworker.create").status).toBe("blocked");
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_CONTRACT_CONFLICT",
      details: expect.objectContaining({
        unexpected_positionals: ["<name>"],
      }),
    }));
  });

  it("requires the usage command path immediately after the CLI program", async () => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: catalog.supported.map(({ command_path }) =>
        command(...command_path)),
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      operation.operation_id === "team-private-digiworker.create"
        ? `Usage: octopus-cli rogue ${operation.command_path.join(" ")} [options]\n--body-file <path>\n--json\n`
        : operationHelp(operation),
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "team-private-digiworker.create").status).toBe("blocked");
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_CONTRACT_CONFLICT",
      details: expect.objectContaining({ command_path_matches: false }),
    }));
  });

  it("compares versioned positional argument shape exactly", async () => {
    const loaded = await loadOperationCatalog(CATALOG);
    const catalog = structuredClone(loaded);
    byId(catalog, "team-private-digiworker.create").positional_args = ["<name>"];
    const index = buildCommandIndex({
      commands: catalog.supported.map(({ command_path }) =>
        command(...command_path)),
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      `Usage: octopus-cli ${operation.command_path.join(" ")} ${
        operation.operation_id === "team-private-digiworker.create" ? "<other>" : ""
      } [options]\n${operation.options?.payload ? "--body-file <path>\n" : ""}--json\n`,
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "team-private-digiworker.create").status).toBe("blocked");
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      details: expect.objectContaining({
        expected_positionals: ["<name>"],
        observed_positionals: ["<other>"],
      }),
    }));
  });

  it.each([
    [
      "value option without a value placeholder",
      "--body-file\n--json\n",
      "payload",
    ],
    [
      "boolean output option with a value",
      "--body-file <path>\n--json <path>\n",
      "output",
    ],
  ])("blocks %s", async (_name, optionLines, semantic) => {
    const catalog = await loadOperationCatalog(CATALOG);
    const index = buildCommandIndex({
      commands: catalog.supported.map(({ command_path }) =>
        command(...command_path)),
    });
    const leafHelp = new Map(catalog.supported.map((operation) => [
      operation.operation_id,
      operationHelp(
        operation,
        operation.operation_id === "team-private-digiworker.create"
          ? optionLines
          : null,
      ),
    ]));

    const evaluated = evaluateOperationCatalog(catalog, index, leafHelp);

    expect(evaluated.operations.find(({ operation_id }) =>
      operation_id === "team-private-digiworker.create").status).toBe("blocked");
    expect(evaluated.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_CONTRACT_CONFLICT",
      details: expect.objectContaining({
        option_conflicts: expect.arrayContaining([
          expect.objectContaining({ semantic }),
        ]),
      }),
    }));
  });
});
