import { lstat, open } from "node:fs/promises";

import { parseSafeJson } from "../contracts/safe-data.js";
import {
  readContainedRegularFileSnapshotNoFollow,
} from "../project/project-runtime.js";
import { canonicalBytes } from "../shared/canonical.js";
import { commandResult } from "../shared/result.js";
import {
  buildCommandIndex,
  commandPathSlug,
  evaluateOperationCatalog,
} from "./operation-catalog.js";

const GENERATED_BY = "aiworker-fde-kit/inspect-octopus-cli";

export class CliEvidenceError extends Error {
  constructor(message, details = {}, cause, exitCode = 1) {
    super(message, cause ? { cause } : undefined);
    this.name = "CliEvidenceError";
    this.code = "E_CLI_EVIDENCE_INVALID";
    this.exitCode = exitCode;
    this.details = details;
  }
}

async function readRegular(root, relativePath) {
  try {
    const snapshot = await readContainedRegularFileSnapshotNoFollow(
      { lstat, open },
      root,
      relativePath,
    );
    return snapshot.bytes;
  } catch (error) {
    throw new CliEvidenceError(
      `Required CLI evidence is missing or unsafe: ${relativePath}.`,
      { path: relativePath },
      error,
      3,
    );
  }
}

function parseEvidence(bytes, relativePath) {
  try {
    return parseSafeJson(bytes.toString("utf8"), relativePath);
  } catch (error) {
    throw new CliEvidenceError(
      `CLI evidence is not safe JSON: ${relativePath}.`,
      { path: relativePath },
      error,
    );
  }
}

export async function loadCliEvidence(
  evidenceRoot,
  supportedOperations,
  catalog,
  options = {},
) {
  const metadata = await lstat(evidenceRoot).catch((error) => {
    throw new CliEvidenceError(
      "CLI evidence directory is missing or unreadable.",
      { path: evidenceRoot },
      error,
      3,
    );
  });
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new CliEvidenceError(
      "CLI evidence path must be a non-symbolic directory.",
      { path: evidenceRoot },
      undefined,
      3,
    );
  }
  const [versionBytes, helpBytes, indexBytes, rawHelpBytes] =
    await Promise.all([
      readRegular(evidenceRoot, "octopus-cli-version.json"),
      readRegular(evidenceRoot, "octopus-cli-help.json"),
      readRegular(evidenceRoot, "cli-command-index.json"),
      readRegular(evidenceRoot, "diagnostics/raw/help-json.json"),
    ]);
  const version = parseEvidence(versionBytes, "octopus-cli-version.json");
  const help = parseEvidence(helpBytes, "octopus-cli-help.json");
  const index = parseEvidence(indexBytes, "cli-command-index.json");
  const rawHelp = parseEvidence(
    rawHelpBytes,
    "diagnostics/raw/help-json.json",
  );
  if (
    version.generated_by !== GENERATED_BY ||
    help.generated_by !== GENERATED_BY ||
    index.generated_by !== GENERATED_BY ||
    version.schema_version !== 1 ||
    help.schema_version !== 1 ||
    index.schema_version !== 1 ||
    help.evidence_scope !== "command-path-presence-only" ||
    index.evidence_scope !== "command-path-presence-with-catalog-overlay" ||
    index.catalog_version !== catalog.catalog_version ||
    index.source_revision !== catalog.source_revision ||
    canonicalBytes(help.help).equals(canonicalBytes(rawHelp)) !== true ||
    typeof version.npm_package?.version !== "string" ||
    typeof version.cli_self_reported?.version !== "string" ||
    !Array.isArray(index.operations) ||
    !Array.isArray(index.commands)
  ) {
    throw new CliEvidenceError(
      "CLI evidence documents do not satisfy the Task 6 raw-evidence contract.",
    );
  }
  const catalogById = new Map(
    catalog.supported.map((operation) => [operation.operation_id, operation]),
  );
  const statusById = new Map(
    index.operations.map((operation) => [
      operation.operation_id,
      operation,
    ]),
  );
  const recomputedIndex = buildCommandIndex(rawHelp);
  if (
    !canonicalBytes(recomputedIndex.commands)
      .equals(canonicalBytes(index.commands))
  ) {
    throw new CliEvidenceError(
      "CLI command index does not match the preserved raw help-json evidence.",
    );
  }
  const presentCommands = new Set(
    recomputedIndex.commands.map(({ path_text: pathText }) => pathText),
  );
  const allLeafHelp = new Map();
  const allBodyProbes = new Map();
  for (const operation of catalog.supported) {
    if (!presentCommands.has(operation.command_path.join(" "))) continue;
    const leafRelativePath =
      `diagnostics/raw/leaf-help/${commandPathSlug(operation.command_path)}.txt`;
    allLeafHelp.set(
      operation.operation_id,
      (await readRegular(evidenceRoot, leafRelativePath)).toString("utf8"),
    );
    const status = statusById.get(operation.operation_id);
    if (status?.evidence?.dryrun_body_probe !== undefined) {
      const bodyProbeRelativePath =
        `diagnostics/raw/body-probes/${commandPathSlug(operation.command_path)}.json`;
      allBodyProbes.set(
        operation.operation_id,
        parseEvidence(
          await readRegular(evidenceRoot, bodyProbeRelativePath),
          bodyProbeRelativePath,
        ),
      );
    }
  }
  const completeEvaluation = evaluateOperationCatalog(
    catalog,
    recomputedIndex,
    allLeafHelp,
    allBodyProbes,
  );
  if (
    !canonicalBytes(completeEvaluation.operations)
      .equals(canonicalBytes(index.operations)) ||
    !canonicalBytes(commandResult(completeEvaluation.issues).issues)
      .equals(canonicalBytes(index.issues))
  ) {
    throw new CliEvidenceError(
      "CLI operation overlay does not exactly match the complete raw-evidence evaluation.",
    );
  }
  for (const operation of supportedOperations) {
    const contract = catalogById.get(operation.operation_id);
    const status = statusById.get(operation.operation_id);
    const commandText = contract?.command_path.join(" ");
    if (
      !contract ||
      status?.status !== "supported" ||
      status.evidence?.command_present !== true ||
      status.evidence?.leaf_help_checked !== true ||
      status.evidence?.leaf_help_compatible !== true
    ) {
      throw new CliEvidenceError(
        `CLI evidence does not support operation ${operation.operation_id}.`,
        { operation_id: operation.operation_id },
      );
    }
    const leafRelativePath =
      `diagnostics/raw/leaf-help/${commandPathSlug(contract.command_path)}.txt`;
    const leaf = allLeafHelp.get(operation.operation_id);
    const evaluated = evaluateOperationCatalog(
      {
        ...catalog,
        supported: [contract],
        manual_required: [],
      },
      recomputedIndex,
      new Map([[operation.operation_id, leaf]]),
      allBodyProbes.has(operation.operation_id)
        ? new Map([[operation.operation_id, allBodyProbes.get(operation.operation_id)]])
        : new Map(),
    );
    const recomputed = evaluated.operations.find(({ operation_id: id }) =>
      id === operation.operation_id);
    if (
      recomputed?.status !== "supported" ||
      !canonicalBytes(recomputed).equals(canonicalBytes(status))
    ) {
      throw new CliEvidenceError(
        `Raw leaf help shape or command-index overlay conflicts for ${operation.operation_id}.`,
        {
          operation_id: operation.operation_id,
          path: leafRelativePath,
          command_path: commandText,
        },
      );
    }
  }
  let contextProbe = null;
  if (options.requireContext === true) {
    const contract = catalog.context_probe;
    if (!contract) {
      throw new CliEvidenceError(
        "Versioned CLI evidence contract has no read-only context probe.",
      );
    }
    const commandText = contract.command_path.join(" ");
    if (!index.commands.some(({ path_text: pathText }) =>
      pathText === commandText)) {
      throw new CliEvidenceError(
        "CLI evidence does not expose the cataloged read-only context probe.",
        { command_path: contract.command_path },
      );
    }
    const leafRelativePath =
      `diagnostics/raw/leaf-help/${commandPathSlug(contract.command_path)}.txt`;
    const leaf = (await readRegular(evidenceRoot, leafRelativePath))
      .toString("utf8");
    const evaluated = evaluateOperationCatalog(
      {
        ...catalog,
        supported: [contract],
        manual_required: [],
      },
      recomputedIndex,
      new Map([[contract.operation_id, leaf]]),
    );
    const probeResult = evaluated.operations.find(({ operation_id: id }) =>
      id === contract.operation_id);
    if (probeResult?.status !== "supported") {
      throw new CliEvidenceError(
        "Raw context-probe leaf help conflicts with its versioned read-only contract.",
        { command_path: contract.command_path },
      );
    }
    contextProbe = structuredClone(contract);
  }
  return {
    versions: {
      npm_package: version.npm_package.version,
      cli_self_reported: version.cli_self_reported.version,
    },
    version,
    help,
    index,
    contextProbe,
  };
}
