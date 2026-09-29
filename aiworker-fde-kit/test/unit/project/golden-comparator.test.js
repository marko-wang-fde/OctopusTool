import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";

import {
  compareGoldenProject,
  hashStructuredArtifact,
} from "../../../src/project/golden-comparator.js";

let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-golden-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function write(relativePath, bytes, mode) {
  const target = path.join(temporaryRoot, ...relativePath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  if (mode !== undefined) await chmod(target, mode);
}

function declaration(files) {
  return { schema_version: 1, files };
}

describe("Golden structured hashing", () => {
  it("safe-parses YAML and JSON then hashes their RFC 8785 canonical form", () => {
    const expected =
      "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777";
    expect(hashStructuredArtifact(Buffer.from('{"b":2,"a":1}\n'), "a.json"))
      .toBe(expected);
    expect(hashStructuredArtifact(Buffer.from("b: 2\na: 1\n"), "a.yaml"))
      .toBe(expected);
  });

  it.each([
    ["anchor.yaml", "a: &bad 1\nb: *bad\n"],
    ["tag.yaml", "a: !!timestamp 2026-07-24\n"],
    ["key.yaml", "? [a, b]\n: nope\n"],
    ["nan.yaml", "a: .nan\n"],
  ])("rejects unsafe YAML before hashing: %s", (name, content) => {
    expect(() => hashStructuredArtifact(Buffer.from(content), name)).toThrow();
  });
});

describe("Golden project comparison", () => {
  it("normalizes separators and sorts paths by UTF-8 bytes", async () => {
    await write("z.md", "# Z\n");
    await write("é.md", "# Accent\n");
    await write("a/a.md", "# A\n");
    const result = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        { path: "z.md", kind: "markdown", sha256: null, required_literals: ["# Z"], forbidden_literals: [] },
        { path: "é.md", kind: "markdown", sha256: null, required_literals: ["# Accent"], forbidden_literals: [] },
        { path: "a\\a.md", kind: "markdown", sha256: null, required_literals: ["# A"], forbidden_literals: [] },
      ]),
    });

    expect(result.actual_paths).toEqual(["a/a.md", "z.md", "é.md"]);
    expect(result.expected_paths).toEqual(["a/a.md", "z.md", "é.md"]);
    expect(result.issues).toEqual([]);
  });

  it("uses the normalized actual path to inspect malicious forbidden content", async () => {
    await write("nested\\doc.md", "# Document\nDO_NOT_SHIP\n");
    const result = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "nested/doc.md",
          kind: "markdown",
          sha256: null,
          required_literals: ["# Document"],
          forbidden_literals: ["DO_NOT_SHIP"],
        },
      ]),
    });

    expect(result.actual_paths).toEqual(["nested/doc.md"]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_GOLDEN_FORBIDDEN_LITERAL",
      path: "nested/doc.md",
    }));
    expect(result.matched_files).toBe(0);
  });

  it("rejects two raw actual paths that collide after POSIX normalization", async () => {
    await write("a\\b.md", "# Backslash\n");
    await write("a/b.md", "# Slash\n");

    await expect(compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "a/b.md",
          kind: "markdown",
          sha256: null,
          required_literals: ["# Slash"],
          forbidden_literals: [],
        },
      ]),
    })).rejects.toThrow(/collision/iu);
  });

  it.each([
    ["control\u0001.md", /control/iu],
    [".\\dot.md", /dot path segments/iu],
    ["..\\escape.md", /dot path segments/iu],
    ["\\absolute.md", /absolute/iu],
  ])("rejects an unsafe raw actual path: %s", async (artifactPath, error) => {
    await write(artifactPath, "# Unsafe\n");
    await expect(compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([]),
    })).rejects.toThrow(error);
  });

  it("reports every missing and unexpected file", async () => {
    await write("actual.md", "# Actual\n");
    const result = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        { path: "missing.md", kind: "markdown", sha256: null, required_literals: [], forbidden_literals: [] },
      ]),
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_GOLDEN_FILE_MISSING", path: "missing.md" }),
      expect.objectContaining({ code: "B_GOLDEN_FILE_UNEXPECTED", path: "actual.md" }),
    ]));
  });

  it("normalizes Markdown CRLF and trailing whitespace but enforces literal order and forbiddance", async () => {
    await write("doc.md", "# Title  \r\nalpha\t\r\nbeta\r\n");
    const matching = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "doc.md",
          kind: "markdown",
          sha256: null,
          required_literals: ["# Title", "alpha", "beta"],
          forbidden_literals: ["secret"],
        },
      ]),
    });
    expect(matching.issues).toEqual([]);

    const failing = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "doc.md",
          kind: "markdown",
          sha256: null,
          required_literals: ["beta", "alpha"],
          forbidden_literals: ["# Title"],
        },
      ]),
    });
    expect(failing.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_GOLDEN_LITERAL_ORDER" }),
      expect.objectContaining({ code: "B_GOLDEN_FORBIDDEN_LITERAL" }),
    ]));
  });

  it("checks structured hashes and shell SHA, 0755 mode, and assembly safety", async () => {
    await write("data.json", '{"b":2,"a":1}\n');
    await write(
      "run.sh",
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "run_octopus_assemble() {",
        '  [[ "${1-}" != "" ]] || return 1',
        '  command octopus-cli "$@"',
        "}",
        "run_octopus_assemble 'configure' 'skill' 'set' 'add'",
        "",
      ].join("\n"),
      0o755,
    );
    const jsonHash = hashStructuredArtifact(
      Buffer.from('{"a":1,"b":2}'),
      "data.json",
    );
    const scriptHash = (await import("node:crypto"))
      .createHash("sha256")
      .update(await readFile(path.join(temporaryRoot, "run.sh")))
      .digest("hex");
    const matching = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        { path: "data.json", kind: "json", sha256: jsonHash },
        {
          path: "run.sh",
          kind: "shell",
          sha256: scriptHash,
          mode: "0755",
          required_literals: [
            "set -euo pipefail",
            '[[ "${1-}" != "" ]]',
            "run_octopus_assemble 'configure'",
          ],
          forbidden_literals: [],
          assemble_call_count: 1,
        },
      ]),
    });
    expect(matching.issues).toEqual([]);

    await chmod(path.join(temporaryRoot, "run.sh"), 0o644);
    await writeFile(
      path.join(temporaryRoot, "run.sh"),
      "#!/bin/sh\noctopus-cli configure skill set add\n",
    );
    const failing = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "run.sh",
          kind: "shell",
          sha256: scriptHash,
          mode: "0755",
          required_literals: ["set -euo pipefail"],
          forbidden_literals: [],
          assemble_call_count: 1,
        },
      ]),
    });
    expect(failing.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_GOLDEN_HASH_MISMATCH" }),
      expect.objectContaining({ code: "B_GOLDEN_MODE_MISMATCH" }),
      expect.objectContaining({ code: "B_GOLDEN_ASSEMBLY_UNSAFE" }),
    ]));
  });

  it("rejects env-wrapped octopus-cli even when the declared shell hash matches", async () => {
    const bytes = Buffer.from([
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "run_octopus_assemble() {",
      '  if [[ "${1-}" == "" ]]; then return 1; fi',
      '  command octopus-cli "$@"',
      "}",
      "run_octopus_assemble 'configure'",
      "env octopus-cli configure skill set add",
      "",
    ].join("\n"));
    await write("run.sh", bytes, 0o755);
    const hash = (await import("node:crypto"))
      .createHash("sha256").update(bytes).digest("hex");

    const result = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "run.sh",
          kind: "shell",
          sha256: hash,
          mode: "0755",
          required_literals: ["set -euo pipefail"],
          forbidden_literals: [],
          assemble_call_count: 1,
        },
      ]),
    });
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_GOLDEN_ASSEMBLY_UNSAFE",
    }));
  });

  it("reports a readable but invalid structured artifact as a Golden mismatch", async () => {
    await write("bad.json", '{"duplicate":1,"duplicate":2}\n');
    const result = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "bad.json",
          kind: "json",
          sha256: "0".repeat(64),
        },
      ]),
    });

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_GOLDEN_PARSE",
      path: "bad.json",
    }));
  });

  it("rejects undeclared expectation fields including update switches", async () => {
    await write("doc.md", "# Doc\n");
    await expect(compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "doc.md",
          kind: "markdown",
          sha256: null,
          required_literals: ["# Doc"],
          forbidden_literals: [],
          update: true,
        },
      ]),
    })).rejects.toThrow(/unknown/iu);
  });

  it("rejects kind/extension drift in the expectation contract", async () => {
    await write("data.json", '{"ok":true}\n');
    await expect(compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "data.json",
          kind: "yaml",
          sha256: "0".repeat(64),
        },
      ]),
    })).rejects.toThrow(/extension/iu);
  });

  it("rejects a matching-hash shell that is not UTF-8 LF text", async () => {
    const bytes = Buffer.from(
      "#!/bin/bash\r\nset -euo pipefail\r\nrun_octopus_assemble() {\r\n" +
      '  [[ "${1-}" != "" ]] || return 1\r\n' +
      '  command octopus-cli "$@"\r\n}\r\n' +
      "run_octopus_assemble 'configure'\r\n",
    );
    await write("run.sh", bytes, 0o755);
    const hash = (await import("node:crypto"))
      .createHash("sha256").update(bytes).digest("hex");
    const result = await compareGoldenProject({
      projectRoot: temporaryRoot,
      expected: declaration([
        {
          path: "run.sh",
          kind: "shell",
          sha256: hash,
          mode: "0755",
          required_literals: ["set -euo pipefail"],
          forbidden_literals: [],
          assemble_call_count: 1,
        },
      ]),
    });
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_GOLDEN_SHELL_FORMAT",
    }));
  });

  it("has no update or rewrite path in its public API", async () => {
    const module = await import("../../../src/project/golden-comparator.js");
    expect(Object.keys(module).sort()).toEqual([
      "compareGoldenProject",
      "hashStructuredArtifact",
      "loadExpectedArtifacts",
    ]);
  });

  it("loads the expectation file with safe YAML parsing", async () => {
    const target = path.join(temporaryRoot, "expected.yaml");
    await writeFile(target, stringify(declaration([])));
    const { loadExpectedArtifacts } =
      await import("../../../src/project/golden-comparator.js");
    await expect(loadExpectedArtifacts(target)).resolves.toEqual(declaration([]));
    await writeFile(target, "files: &x []\nalias: *x\n");
    await expect(loadExpectedArtifacts(target)).rejects.toThrow();
  });
});
