import { main as checkRepository } from "../commands/check-repository.js";
import { main as initProject } from "../commands/init-project.js";
import { main as inspectOctopusCli } from "../commands/inspect-octopus-cli.js";
import { main as install } from "../commands/install.js";
import { main as packageDelivery } from "../commands/package-delivery.js";
import { main as renderAssembleScript } from "../commands/render-dryrun-script.js";
import { main as scanPublicRepository } from "../security/public-scan.js";
import { main as testExample } from "../commands/test-example.js";
import { main as validateForwardTest } from "../commands/validate-forward-test.js";
import { main as validateProject } from "../commands/validate-project.js";

const COMMANDS = new Map([
  ["check-repository", checkRepository],
  ["init-project", initProject],
  ["inspect-octopus-cli", inspectOctopusCli],
  ["install", install],
  ["package-delivery", packageDelivery],
  ["render-assemble-script", renderAssembleScript],
  ["render-dryrun-script", renderAssembleScript],
  ["scan-public-repository", scanPublicRepository],
  ["test-example", testExample],
  ["validate-forward-test", validateForwardTest],
  ["validate-project", validateProject],
]);

const [commandName, ...args] = process.argv.slice(2);
const command = COMMANDS.get(commandName);
if (!command) {
  process.stdout.write(`${JSON.stringify({
    exitCode: 2,
    issues: [{
      severity: "BLOCKER",
      code: "B_RUNTIME_COMMAND",
      path: ".",
      message: `Unknown bundled command: ${commandName ?? "<missing>"}`,
      details: {},
    }],
    data: { commands: [...COMMANDS.keys()] },
  })}\n`);
  process.exitCode = 2;
} else {
  process.exitCode = await command(args);
}
