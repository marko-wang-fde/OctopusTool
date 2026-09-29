import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const exec = promisify(execFile);

async function text(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

describe("repository release contract", () => {
  it("publishes the minimal root release guide", async () => {
    const readme = await text("README.md");

    expect(readme).toMatch(/offline .*delivery package/iu);
    expect(readme).toMatch(
      /V1[\s\S]{0,260}directly assemble[\s\S]{0,160}`octopus-cli`/iu,
    );
    expect(readme).toMatch(
      /Unsupported[\s\S]{0,160}(?:Skill upload|Arcubase)[\s\S]{0,160}manual-required/iu,
    );
    for (const prerequisite of [
      /Node(?:\.js)? 20/iu,
      /macOS/iu,
      /Linux/iu,
      /POSIX `?\/bin\/sh`?/u,
      /`?\/bin\/bash`?/u,
      /\bGit\b/u,
    ]) {
      expect(readme).toMatch(prerequisite);
    }
    expect(readme).toMatch(/Codex[\s\S]{0,240}symlink[\s\S]{0,240}copy/iu);
    expect(readme).toMatch(/Claude Code[\s\S]{0,240}symlink[\s\S]{0,240}copy/iu);
    for (const mode of ["new", "materials", "resume"]) {
      expect(readme).toContain(`\`${mode}\``);
    }
    expect(readme).toMatch(
      /preview[\s\S]{0,180}(?:display )?name[\s\S]{0,180}(?:directory|slug)[\s\S]{0,180}confirm/iu,
    );
    expect(readme).toContain(
      "./scripts/validate-project /absolute/project",
    );
    expect(readme).toContain(
      "./scripts/package-delivery /absolute/project --confirm-personal-data",
    );
    for (const status of [
      "draft",
      "reviewable",
      "delivery-ready",
      "cli-assembled",
    ]) {
      expect(readme).toContain(`\`${status}\``);
    }
    expect(readme).toContain("./scripts/render-assemble-script /absolute/project");
    expect(readme).toContain("--run-assembly --profile <name> --team <id>");
    for (const command of [
      "./scripts/test-example --example lead-collector",
      "npm run verify:public",
      "npm run verify:e2e",
      "./scripts/validate-forward-test evals/results",
    ]) {
      expect(readme).toContain(command);
    }
    expect(readme).toContain("[Installation](docs/installation.md)");
    expect(readme).toContain("[Operator guide](docs/fde-operator-guide.md)");
    expect(readme).toContain("[Maintainer guide](docs/maintenance.md)");
    expect(readme).toContain(
      "[Agent forward test](docs/agent-forward-test.md)",
    );
    expect(readme).toContain("[License](LICENSE)");
    expect(readme).toMatch(
      /copy[\s\S]{0,320}manifest[\s\S]{0,180}local trust root[\s\S]{0,160}protect/iu,
    );
  });

  it("publishes explicit end-to-end and public verification gates", async () => {
    const packageJson = JSON.parse(await text("package.json"));
    expect(packageJson.scripts["verify:e2e"]).toBe(
      "vitest run test/integration/end-to-end.test.js",
    );
    expect(packageJson.scripts["verify:public"]).toBe(
      "./scripts/scan-public-repository",
    );
  });

  it("documents installation, operation, maintenance, and the assembly boundary", async () => {
    for (const relativePath of [
      "docs/installation.md",
      "docs/fde-operator-guide.md",
      "docs/maintenance.md",
    ]) {
      await expect(access(path.join(ROOT, relativePath))).resolves.toBeUndefined();
    }
    const skill = await text("SKILL.md");
    expect(skill).toContain("scripts/validate-project");
    expect(skill).toContain("scripts/package-delivery");
    expect(skill).toContain("delivery-ready");
    expect(skill).toContain("cli-assembled");
    expect(skill).toContain("Live assembly gate");
    expect(skill).toContain("docs/installation.md");
    expect(skill).toContain("docs/fde-operator-guide.md");
    expect(skill).toMatch(/octopus-cli[\s\S]{0,160}assembly/iu);
  });

  it("documents supported platforms and copy-manifest trust", async () => {
    const installation = await text("docs/installation.md");
    for (const prerequisite of [
      /Node(?:\.js)? 20/iu,
      /macOS/iu,
      /Linux/iu,
      /POSIX `?\/bin\/sh`?/u,
      /`?\/bin\/bash`?/u,
      /\bGit\b/u,
    ]) {
      expect(installation).toMatch(prerequisite);
    }
    expect(installation).toMatch(
      /copy[\s\S]{0,320}manifest[\s\S]{0,180}local trust root[\s\S]{0,160}protect/iu,
    );
  });

  it("keeps normal CI offline and isolates pinned CLI compatibility evidence", async () => {
    const workflow = parse(await text(".github/workflows/ci.yml"));
    const jobs = workflow.jobs;
    expect(jobs).toHaveProperty("offline");
    expect(jobs).toHaveProperty("octopus-cli-compatibility");
    const offline = JSON.stringify(jobs.offline);
    expect(offline).toContain("npm ci");
    expect(offline).toContain("npm run verify");
    expect(offline).toContain("npm run verify:public");
    expect(offline).toContain("./scripts/test-example --example lead-collector");
    expect(offline).toContain("npm run verify:e2e");
    expect(offline).not.toMatch(/secrets\./u);
    const compatibility = JSON.stringify(jobs["octopus-cli-compatibility"]);
    expect(compatibility).toContain("@syngy/octopus-cli@0.1.1");
    expect(compatibility).toContain("octopus-cli --help-json");
    expect(compatibility).toContain("inspect-octopus-cli");
    expect(compatibility).toContain("test-output/compat-cli");
    expect(compatibility).toContain("test-output/compat-preflight");
    expect(compatibility).not.toMatch(/--profile|--team|--run-dryrun/u);
    expect(compatibility).not.toContain("mkdir -p test-output/compat-cli");
    expect(compatibility).toContain("mkdir -p test-output/compat-preflight");
    expect(compatibility).toContain('"if":"always()"');
    expect(compatibility).toContain('"if-no-files-found":"error"');
  });

  it("runs the compatibility inspector before aggregating probe failures", async () => {
    const workflow = parse(await text(".github/workflows/ci.yml"));
    const steps = workflow.jobs["octopus-cli-compatibility"].steps;
    const compatibilityStep = steps.find(
      (step) => step.name === "Record and inspect CLI contract",
    );
    const script = compatibilityStep.run;
    expect(script).toContain(
      "octopus-cli --version || version_status=$?",
    );
    expect(script).toContain(
      "octopus-cli --help-json > /dev/null || help_status=$?",
    );
    expect(script).toContain(
      '--output "$PWD/test-output/compat-cli" || inspect_status=$?',
    );
    const inspector = script.indexOf("./scripts/inspect-octopus-cli");
    const aggregate = script.indexOf(
      "if (( version_status != 0 || help_status != 0 || inspect_status != 0 )); then",
    );
    expect(inspector).toBeGreaterThan(
      script.indexOf("octopus-cli --help-json"),
    );
    expect(aggregate).toBeGreaterThan(inspector);
    expect(script.slice(0, inspector)).not.toContain("exit 1");

    const upload = steps.find(
      (step) => step.name === "Upload raw compatibility evidence",
    );
    expect(upload.if).toBe("always()");
    expect(upload.with["if-no-files-found"]).toBe("error");
    expect(upload.with.path.trim().split(/\s+/u)).toEqual([
      "test-output/compat-cli",
      "test-output/compat-preflight",
    ]);
  });

  it("executes compatibility probes with an absolute evidence output", async () => {
    const workflow = parse(await text(".github/workflows/ci.yml"));
    const steps = workflow.jobs["octopus-cli-compatibility"].steps;
    const script = steps.find(
      (step) => step.name === "Record and inspect CLI contract",
    ).run;
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fde-ci-contract-"));
    try {
      const bin = path.join(workspace, "bin");
      const scripts = path.join(workspace, "scripts");
      await mkdir(bin);
      await mkdir(scripts);
      const cliPath = path.join(bin, "octopus-cli");
      const inspectorPath = path.join(scripts, "inspect-octopus-cli");
      await writeFile(
        cliPath,
        [
          "#!/usr/bin/env bash",
          "case \"${1:-}\" in",
          "  --version|--help-json) exit 23 ;;",
          "  *) exit 24 ;;",
          "esac",
          "",
        ].join("\n"),
      );
      await writeFile(
        inspectorPath,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "cli_path=",
          "output=",
          "while (( $# > 0 )); do",
          "  case \"$1\" in",
          "    --cli-path) cli_path=$2; shift 2 ;;",
          "    --output) output=$2; shift 2 ;;",
          "    *) exit 90 ;;",
          "  esac",
          "done",
          "printf 'called\\n' > \"$PWD/inspector-called.txt\"",
          "case \"$output\" in",
          "  /*) ;;",
          "  *) exit 91 ;;",
          "esac",
          "test ! -e \"$output\"",
          "test -f \"$PWD/test-output/compat-preflight/preflight.txt\"",
          "test -f \"$PWD/test-output/compat-preflight/preflight.json\"",
          "mkdir -p \"$output\"",
          "printf '%s\\n%s\\n' \"$cli_path\" \"$output\" > \"$output/invocation.txt\"",
          "",
        ].join("\n"),
      );
      await chmod(cliPath, 0o755);
      await chmod(inspectorPath, 0o755);

      let exitCode = 0;
      try {
        await exec("bash", ["-e", "-o", "pipefail", "-c", script], {
          cwd: workspace,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
          },
        });
      } catch (error) {
        exitCode = error.code;
      }

      expect(exitCode).toBe(1);
      await expect(access(path.join(workspace, "inspector-called.txt")))
        .resolves.toBeUndefined();
      const output = path.join(workspace, "test-output/compat-cli");
      const invocationPath = path.join(output, "invocation.txt");
      const evidenceExists = await access(invocationPath)
        .then(() => true, () => false);
      expect(evidenceExists).toBe(true);
      const invocation = (await readFile(
        invocationPath,
        "utf8",
      )).trim().split("\n");
      expect(invocation[0]).toBe(cliPath);
      expect(path.isAbsolute(invocation[1])).toBe(true);
      expect(await realpath(invocation[1])).toBe(await realpath(output));
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("keeps workflow preflight outside the real inspector-owned output", async () => {
    const workflow = parse(await text(".github/workflows/ci.yml"));
    const script = workflow.jobs["octopus-cli-compatibility"].steps.find(
      (step) => step.name === "Record and inspect CLI contract",
    ).run;
    const preflightFile = script.match(
      /> (test-output\/[^/\s]+\/preflight\.txt)/u,
    )?.[1];
    const outputRelative = script.match(
      /--output "\$PWD\/([^"]+)"/u,
    )?.[1];
    expect(preflightFile).toBeTruthy();
    expect(outputRelative).toBe("test-output/compat-cli");

    const workspace = await mkdtemp(path.join(os.tmpdir(), "fde-ci-owner-"));
    try {
      const preflight = path.join(workspace, path.dirname(preflightFile));
      const output = path.join(workspace, outputRelative);
      await mkdir(preflight, { recursive: true });
      await writeFile(
        path.join(preflight, "preflight.txt"),
        "resolution: fixture\n",
      );
      await writeFile(
        path.join(preflight, "preflight.json"),
        '{"schema_version":1,"resolution":"fixture"}\n',
      );

      const completed = await exec(
        path.join(ROOT, "scripts/inspect-octopus-cli"),
        [
          "--fixture-dir",
          path.join(ROOT, "assets/examples/lead-collector/cli-fixture"),
          "--output",
          output,
        ],
        { cwd: workspace },
      );
      expect(JSON.parse(completed.stdout).exitCode).toBe(0);
      await expect(access(path.join(output, ".inspection-owner.json")))
        .resolves.toBeUndefined();
      await expect(access(path.join(preflight, "preflight.txt")))
        .resolves.toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("records missing CLI resolution before the inspector fails", async () => {
    const workflow = parse(await text(".github/workflows/ci.yml"));
    const steps = workflow.jobs["octopus-cli-compatibility"].steps;
    const script = steps.find(
      (step) => step.name === "Record and inspect CLI contract",
    ).run;
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fde-ci-missing-"));
    try {
      const scripts = path.join(workspace, "scripts");
      await mkdir(scripts);
      const inspectorPath = path.join(scripts, "inspect-octopus-cli");
      await writeFile(
        inspectorPath,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "output=",
          "cli_path=not-recorded",
          "while (( $# > 0 )); do",
          "  case \"$1\" in",
          "    --cli-path) cli_path=$2; shift 2 ;;",
          "    --output) output=$2; shift 2 ;;",
          "    *) exit 90 ;;",
          "  esac",
          "done",
          "test ! -e \"$output\"",
          "test -f \"$PWD/test-output/compat-preflight/preflight.txt\"",
          "test -f \"$PWD/test-output/compat-preflight/preflight.json\"",
          "printf '%s\\n' \"$cli_path\" > \"$PWD/inspector-cli-path.txt\"",
          "printf 'called\\n' > \"$PWD/inspector-called.txt\"",
          "exit 47",
          "",
        ].join("\n"),
      );
      await chmod(inspectorPath, 0o755);

      let exitCode = 0;
      try {
        await exec("/bin/bash", ["-e", "-o", "pipefail", "-c", script], {
          cwd: workspace,
          env: {
            ...process.env,
            PATH: "/usr/bin:/bin",
          },
        });
      } catch (error) {
        exitCode = error.code;
      }

      expect(exitCode).toBe(1);
      await expect(access(path.join(workspace, "inspector-called.txt")))
        .resolves.toBeUndefined();
      expect(await readFile(
        path.join(workspace, "inspector-cli-path.txt"),
        "utf8",
      ))
        .toBe("\n");
      const preflight = path.join(
        workspace,
        "test-output/compat-preflight",
      );
      expect(await readFile(path.join(preflight, "preflight.txt"), "utf8"))
        .toContain("resolution: missing");
      expect(JSON.parse(
        await readFile(path.join(preflight, "preflight.json"), "utf8"),
      )).toMatchObject({
        schema_version: 1,
        resolution: "missing",
      });
      await expect(access(path.join(workspace, "test-output/compat-cli")))
        .rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
