import {
  mkdtemp,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { lstatSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildOperationArgv,
  posixQuote,
  renderDryrunScript,
  writeDryrunScriptAtomic,
} from "../../../src/assembly/dryrun-renderer.js";
import {
  inspectRenderedDryrunScript,
} from "../../../src/assembly/shell-safety.js";
import {
  BASH_PATH,
  runLocalProcess,
} from "../../../src/shared/local-process.js";

const catalogOperation = {
  operation_id: "skill-set.create",
  command_path: ["configure", "skill", "set", "add"],
  positional_args: [],
  options: {
    payload: "--body-file",
    output: "--json",
  },
  option_shape: {
    payload: { arity: "value", required: true, allowed_forms: ["separate"] },
    output: { arity: "boolean", required: true, allowed_forms: ["standalone"] },
  },
};
const operation = {
  operation_id: "skill-set.create",
  support: "supported",
  operation_kind: "write",
  command_path: ["configure", "skill", "set", "add"],
  payload_file: "assembly/payloads/skill-set-create.json",
  depends_on: [],
};

describe("live assembly argv rendering", () => {
  it("restores a concurrent script replacement to the live target", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fde-script-race-"));
    const target = path.join(root, "assemble.sh");
    await writeFile(target, "# old\n");
    const concurrent = Buffer.from("# concurrent\n");
    let injected = false;
    await expect(writeDryrunScriptAtomic(
      target,
      Buffer.from("# new\n"),
      {
        fs: {
          rename: async (source, backup) => {
            if (
              path.basename(source) === path.basename(target) &&
              !injected
            ) {
              injected = true;
              const replacement = `${source}.concurrent`;
              await writeFile(replacement, concurrent);
              await rename(replacement, source);
            }
            return rename(source, backup);
          },
        },
      },
    )).rejects.toMatchObject({
      recoveryPaths: expect.any(Array),
    });
    expect(await readFile(target)).toEqual(concurrent);
  });

  it("builds structured live argv and quotes every argument", () => {
    expect(buildOperationArgv(operation, catalogOperation)).toEqual([
      "configure",
      "skill",
      "set",
      "add",
      "--body-file",
      "assembly/payloads/skill-set-create.json",
      "--json",
    ]);
    expect(posixQuote("a'b")).toBe("'a'\"'\"'b'");
  });

  it.each([
    ["newline", { ...operation, operation_id: "skill\nset" }],
    ["NUL", { ...operation, payload_file: "assembly/payloads/a\u0000.json" }],
    ["substitution", { ...operation, payload_file: "assembly/payloads/$(id).json" }],
    ["backtick", { ...operation, payload_file: "assembly/payloads/`id`.json" }],
    ["metachar", { ...operation, payload_file: "assembly/payloads/a;id.json" }],
    ["escape", { ...operation, payload_file: "../secret.json" }],
    ["option", { ...operation, command_path: ["skill", "--unsafe"] }],
    ["free text", { ...operation, command: "octopus-cli configure skill set add" }],
  ])("rejects %s", (_label, unsafe) => {
    expect(() => buildOperationArgv(unsafe, catalogOperation)).toThrow();
  });

  it("renders a fixed live assembly Bash program without dry-run flags", () => {
    const bytes = renderDryrunScript([operation], new Map([
      [operation.operation_id, catalogOperation],
    ]));
    const text = bytes.toString("utf8");

    expect(text.startsWith(
      "#!/usr/bin/env bash\nset -euo pipefail\n",
    )).toBe(true);
    expect(text.match(/command octopus-cli/gu)).toHaveLength(1);
    expect(text.match(/^run_octopus_assemble 'configure'/gmu)).toHaveLength(1);
    expect(text).not.toContain("--dryrun");
    expect(text).toContain("verify_generated_assemble_calls");
    expect(inspectRenderedDryrunScript(bytes, bytes)).toEqual({
      valid: true,
      code: null,
    });
  });

  it("renders output bindings for bodyless positional operations", () => {
    const uploadOperation = {
      operation_id: "skill.upload",
      support: "supported",
      operation_kind: "write",
      command_path: ["configure", "skill", "upload", "add"],
      payload_file: "assembly/payloads/skill-upload.json",
      payload_schema_uri: "assembly/payloads/skill-upload.schema.json",
      depends_on: [],
      output_bindings: {
        skill_id: [["data", "skill", "id"], ["skill", "id"]],
      },
    };
    const enableOperation = {
      operation_id: "skill.enable-assembly",
      support: "supported",
      operation_kind: "write",
      command_path: ["configure", "skill", "enable-assembly", "add"],
      payload_file: null,
      payload_schema_uri: null,
      depends_on: ["skill.upload"],
      positional_bindings: [
        {
          from_operation: "skill.upload",
          binding: "skill_id",
        },
      ],
    };
    const bytes = renderDryrunScript(
      [uploadOperation, enableOperation],
      new Map([
        [uploadOperation.operation_id, {
          operation_id: "skill.upload",
          command_path: ["configure", "skill", "upload", "add"],
          positional_args: [],
          options: { payload: "--body-file", output: "--json" },
          option_shape: {
            payload: { arity: "value", required: true, allowed_forms: ["separate"] },
            output: { arity: "boolean", required: true, allowed_forms: ["standalone"] },
          },
        }],
        [enableOperation.operation_id, {
          operation_id: "skill.enable-assembly",
          command_path: ["configure", "skill", "enable-assembly", "add"],
          positional_args: ["<id>"],
          options: { output: "--json" },
          option_shape: {
            output: { arity: "boolean", required: true, allowed_forms: ["standalone"] },
          },
        }],
      ]),
    );
    const text = bytes.toString("utf8");

    expect(text).toContain("json_get_first_string");
    expect(text).toContain("run_octopus_assemble_capture 'skill.upload'");
    expect(text).toContain("AIWORKER_FDE_BINDING_SKILL_UPLOAD_SKILL_ID=");
    expect(text).toContain(
      "run_octopus_assemble 'configure' 'skill' 'enable-assembly' 'add' \"$AIWORKER_FDE_BINDING_SKILL_UPLOAD_SKILL_ID\" '--json'",
    );
    expect(text).not.toContain("--body-file' ''");
    expect(text).not.toContain("--dryrun");
  });

  it("checks Bash syntax through an injected absolute-command process adapter", () => {
    const bytes = renderDryrunScript([operation], new Map([
      [operation.operation_id, catalogOperation],
    ]));
    const calls = [];
    const processAdapter = (command, args, options) => {
      calls.push({ command, args, options });
      expect(command).toMatch(/^\/(?:bin\/bash|.+\/bash)$/u);
      expect(args[0]).toBe("-n");
      expect(args).toHaveLength(2);
      const script = args[1];
      const parentMetadata = lstatSync(path.dirname(script));
      expect(parentMetadata.isDirectory()).toBe(true);
      expect(parentMetadata.isSymbolicLink()).toBe(false);
      expect(parentMetadata.mode & 0o777).toBe(0o700);
      const metadata = lstatSync(script);
      expect(metadata.isFile()).toBe(true);
      expect(metadata.isSymbolicLink()).toBe(false);
      expect(metadata.mode & 0o777).toBe(0o600);
      expect(readFileSync(script)).toEqual(bytes);
      expect(options).toEqual({ shell: false });
      return { status: 0, signal: null, error: null };
    };

    expect(inspectRenderedDryrunScript(bytes, bytes, {
      processAdapter,
    })).toEqual({
      valid: true,
      code: null,
    });
    expect(calls).toHaveLength(1);
    expect(() => lstatSync(calls[0].args[1])).toThrow(
      expect.objectContaining({ code: "ENOENT" }),
    );
  });

  it("limits the default local process adapter to absolute Bash -n file checks", () => {
    expect(path.isAbsolute(BASH_PATH)).toBe(true);
    expect(path.basename(BASH_PATH)).toBe("bash");
    for (const [command, args, options] of [
      ["bash", ["-n", "/private/tmp/script.sh"], { shell: false }],
      [BASH_PATH, ["-c", "true"], { shell: false }],
      [BASH_PATH, ["-n", "relative.sh"], { shell: false }],
      [BASH_PATH, ["-n", "/private/tmp/script.sh"], { shell: true }],
      [BASH_PATH, ["-n", "/bin/bash"], { shell: false }],
    ]) {
      expect(() => runLocalProcess(command, args, options)).toThrow(
        /only permits absolute Bash -n/iu,
      );
    }
  });

  it("detects byte tampering before Bash execution", () => {
    const expected = renderDryrunScript([operation], new Map([
      [operation.operation_id, catalogOperation],
    ]));
    const tampered = Buffer.from(
      expected.toString("utf8").replace("'skill' ", ""),
    );

    expect(inspectRenderedDryrunScript(tampered, expected)).toEqual({
      valid: false,
      code: "B_ASSEMBLY_SCRIPT_TAMPERED",
    });
  });
});
