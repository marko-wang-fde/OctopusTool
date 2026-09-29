import { readFile } from "node:fs/promises";

import { parseSafeYaml } from "../contracts/safe-data.js";
import { issue } from "../shared/result.js";

const WRITE_WORDS = new Set([
  "add",
  "apply",
  "archive",
  "assign",
  "create",
  "delete",
  "deploy",
  "grant",
  "hire",
  "import",
  "invite",
  "publish",
  "remove",
  "set",
  "update",
  "upload",
]);
const READ_ONLY_LEAF_VERBS = new Set([
  "describe",
  "export",
  "get",
  "help",
  "inspect",
  "list",
  "query",
  "read",
  "search",
  "show",
  "status",
  "version",
  "view",
  "whoami",
]);

function comparePath(left, right) {
  return Buffer.compare(
    Buffer.from(left.path_text, "utf8"),
    Buffer.from(right.path_text, "utf8"),
  );
}

export class OperationCatalogError extends Error {
  constructor(message, details = {}, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "OperationCatalogError";
    this.code = "E_OPERATION_CATALOG_INVALID";
    this.details = details;
  }
}

export class CliHelpContractError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "CliHelpContractError";
    this.code = "E_CLI_HELP_CONTRACT";
    this.details = details;
  }
}

const COMMAND_TOKEN_PATTERN = /^[a-z0-9_][a-z0-9_.-]*$/iu;

function commandTokenReason(token) {
  if (typeof token !== "string" || token.length === 0) {
    return "must be a non-empty string";
  }
  if (!COMMAND_TOKEN_PATTERN.test(token)) {
    return "contains characters outside the safe command-token grammar";
  }
  if (token === "." || token === "..") {
    return "must not be a traversal segment";
  }
  if (token.includes("--")) {
    return "must not contain a double-hyphen option marker";
  }
  return null;
}

export function assertCommandPath(value, label = "command_path") {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OperationCatalogError(
      `${label} must be a non-empty command-token array.`,
      { label },
    );
  }
  for (const [index, token] of value.entries()) {
    const reason = commandTokenReason(token);
    if (reason) {
      throw new OperationCatalogError(
        `${label}[${index}] ${reason}.`,
        { label, index, token },
      );
    }
  }
  return [...value];
}

export function commandPathSlug(commandPath) {
  return assertCommandPath(commandPath).join("-");
}

function catalogFailure(message, details = {}) {
  throw new OperationCatalogError(message, details);
}

function assertCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    catalogFailure("Assembly operation catalog must be an object.");
  }
  if (
    typeof catalog.catalog_version !== "string" ||
    typeof catalog.source_revision !== "string"
  ) {
    catalogFailure("Assembly operation catalog is missing version metadata.");
  }
  const skillVariable = catalog.artifact_variables?.["<skill-slug>"];
  if (
    !skillVariable ||
    JSON.stringify(Object.keys(skillVariable).sort()) !==
      JSON.stringify([
        "cardinality",
        "expansion",
        "source",
        "transform",
      ]) ||
    skillVariable.source !== "fde-project.yaml#skills[].id" ||
    skillVariable.transform !== "strip-skill-prefix-and-kebab-case" ||
    skillVariable.cardinality !== "one-per-approved-skill" ||
    skillVariable.expansion !== "expand-once-per-approved-skill"
  ) {
    catalogFailure(
      "Assembly operation catalog has an invalid controlled artifact-variable contract.",
    );
  }
  const contextProbe = catalog.context_probe;
  if (
    !contextProbe ||
    contextProbe.executor !== "octopus-cli" ||
    contextProbe.operation_kind !== "read" ||
    typeof contextProbe.operation_id !== "string" ||
    !Array.isArray(contextProbe.positional_args) ||
    contextProbe.positional_args.length !== 0 ||
    contextProbe.options?.output !== "--json" ||
    contextProbe.options?.profile !== "--profile" ||
    contextProbe.option_shape?.profile?.arity !== "value" ||
    contextProbe.option_shape.profile.required !== false ||
    !contextProbe.option_shape.profile.allowed_forms?.includes("separate") ||
    contextProbe.option_shape?.output?.arity !== "boolean" ||
    contextProbe.option_shape.output.required !== true ||
    !contextProbe.option_shape.output.allowed_forms?.includes("standalone") ||
    contextProbe.output_contract?.format !== "json" ||
    !Array.isArray(contextProbe.output_contract.profile_path) ||
    !Array.isArray(contextProbe.output_contract.team_path) ||
    contextProbe.explicit_context_argv !== null
  ) {
    catalogFailure(
      "Assembly operation catalog must define one fixed read-only context probe.",
    );
  }
  assertCommandPath(contextProbe.command_path, "context_probe.command_path");
  if (
    !Array.isArray(catalog.supported) ||
    !Array.isArray(catalog.manual_required)
  ) {
    catalogFailure(
      "Assembly operation catalog must define supported and manual_required.",
    );
  }
  const operationIds = new Set();
  for (const operation of [
    ...catalog.supported,
    ...catalog.manual_required,
  ]) {
    if (
      !operation ||
      typeof operation.operation_id !== "string" ||
      operationIds.has(operation.operation_id)
    ) {
      catalogFailure("Assembly operation IDs must be unique strings.");
    }
    operationIds.add(operation.operation_id);
  }
  const canonicalPaths = new Set();
  const fixtureSlugs = new Set();
  for (const operation of catalog.supported) {
    const commandPath = assertCommandPath(
      operation.command_path,
      `${operation.operation_id}.command_path`,
    );
    const canonicalPath = commandPath.join(" ");
    if (canonicalPaths.has(canonicalPath)) {
      catalogFailure(
        `Supported command paths must be canonically unique: ${canonicalPath}.`,
        { command_path: commandPath },
      );
    }
    canonicalPaths.add(canonicalPath);
    const fixtureSlug = commandPathSlug(commandPath);
    if (fixtureSlugs.has(fixtureSlug)) {
      catalogFailure(
        `Supported command paths must have unique fixture slugs: ${fixtureSlug}.`,
        { command_path: commandPath, fixture_slug: fixtureSlug },
      );
    }
    fixtureSlugs.add(fixtureSlug);
    if (
      !operation.options ||
      typeof operation.options !== "object" ||
      Array.isArray(operation.options)
    ) {
      catalogFailure(`${operation.operation_id}.options must be an object.`);
    }
    if (!Array.isArray(operation.positional_args)) {
      catalogFailure(
        `${operation.operation_id}.positional_args must be an array.`,
      );
    }
    const semantics = Object.keys(operation.options);
    if (
      !operation.option_shape ||
      typeof operation.option_shape !== "object" ||
      Array.isArray(operation.option_shape) ||
      semantics.some((semantic) => {
        const shape = operation.option_shape[semantic];
        return (
          !shape ||
          !["boolean", "value"].includes(shape.arity) ||
          typeof shape.required !== "boolean" ||
          !Array.isArray(shape.allowed_forms) ||
          shape.allowed_forms.length === 0 ||
          shape.allowed_forms.some((form) =>
            !["standalone", "separate", "equals"].includes(form))
        );
      })
    ) {
      catalogFailure(
        `${operation.operation_id}.option_shape must define every option semantic.`,
      );
    }
    if (operation.manual_fallback !== undefined) {
      const fallback = operation.manual_fallback;
      if (
        fallback?.executor !== "admin-manual" ||
        !Array.isArray(fallback.manual_artifacts) ||
        fallback.manual_artifacts.length === 0 ||
        !Array.isArray(fallback.manual_instructions) ||
        fallback.manual_instructions.length === 0 ||
        typeof fallback.recovery_condition !== "string" ||
        typeof fallback.verification_condition !== "string"
      ) {
        catalogFailure(
          `${operation.operation_id}.manual_fallback is invalid.`,
        );
      }
    }
  }
  return catalog;
}

export async function loadOperationCatalog(catalogPath) {
  try {
    const text = await readFile(catalogPath, "utf8");
    return assertCatalog(parseSafeYaml(text, catalogPath));
  } catch (error) {
    if (error instanceof OperationCatalogError) throw error;
    throw new OperationCatalogError(
      "Assembly operation catalog could not be loaded safely.",
      { catalog_path: catalogPath },
      error,
    );
  }
}

function helpFailure(message, details = {}) {
  throw new CliHelpContractError(message, details);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    helpFailure(`${label} must be an object.`, { label });
  }
}

function assertHelpToken(token, label) {
  const reason = commandTokenReason(token);
  if (reason) helpFailure(`${label} ${reason}.`, { label, token });
}

function validateHelpOptions(options, label) {
  if (options === undefined) return;
  if (!Array.isArray(options)) {
    helpFailure(`${label} must be an array.`, { label });
  }
  for (const [index, option] of options.entries()) {
    const optionLabel = `${label}[${index}]`;
    assertPlainObject(option, optionLabel);
    const identifiers = ["name", "flag", "flags"]
      .filter((key) => option[key] !== undefined);
    if (identifiers.length === 0) {
      helpFailure(
        `${optionLabel} must define name, flag, or flags.`,
        { label: optionLabel },
      );
    }
    for (const key of [
      "name",
      "flag",
      "flags",
      "description",
      "argumentName",
    ]) {
      if (
        option[key] !== undefined &&
        (typeof option[key] !== "string" ||
          option[key].length === 0 ||
          /[\u0000-\u001f\u007f]/u.test(option[key]))
      ) {
        helpFailure(
          `${optionLabel}.${key} must be a non-empty printable string.`,
          { label: `${optionLabel}.${key}` },
        );
      }
    }
    for (const key of ["required", "variadic"]) {
      if (option[key] !== undefined && typeof option[key] !== "boolean") {
        helpFailure(
          `${optionLabel}.${key} must be boolean.`,
          { label: `${optionLabel}.${key}` },
        );
      }
    }
  }
}

function commandChildren(node, label) {
  const keys = ["commands", "subcommands", "children"]
    .filter((key) => node[key] !== undefined);
  for (const key of keys) {
    if (!Array.isArray(node[key])) {
      helpFailure(`${label}.${key} must be an array.`, {
        label: `${label}.${key}`,
      });
    }
  }
  if (keys.length > 1) {
    helpFailure(
      `${label} must not define multiple child-command collections.`,
      { label, keys },
    );
  }
  return keys.length === 0 ? [] : node[keys[0]];
}

function explicitPath(node, label) {
  if (node.path === undefined) return null;
  let segments;
  if (Array.isArray(node.path)) {
    segments = [...node.path];
  } else if (typeof node.path === "string") {
    if (node.path.length === 0 || node.path.trim() !== node.path) {
      helpFailure(`${label}.path must be a canonical command path.`, {
        label: `${label}.path`,
      });
    }
    segments = node.path.split(/\s+/u);
  } else {
    helpFailure(`${label}.path must be a string or string array.`, {
      label: `${label}.path`,
    });
  }
  if (segments[0] === "octopus-cli") segments = segments.slice(1);
  if (segments.length === 0) {
    helpFailure(`${label}.path must identify a command.`, {
      label: `${label}.path`,
    });
  }
  segments.forEach((token, index) =>
    assertHelpToken(token, `${label}.path[${index}]`));
  return segments;
}

function visitCommand(node, inheritedPath, found, label) {
  assertPlainObject(node, label);
  assertHelpToken(node.name, `${label}.name`);
  for (const key of ["description", "help"]) {
    if (node[key] !== undefined && typeof node[key] !== "string") {
      helpFailure(`${label}.${key} must be a string.`, {
        label: `${label}.${key}`,
      });
    }
  }
  validateHelpOptions(node.options, `${label}.options`);
  const namedPath = [...inheritedPath, node.name];
  const declaredPath = explicitPath(node, label);
  const commandPath = declaredPath ?? namedPath;
  if (declaredPath && declaredPath.at(-1) !== node.name) {
    helpFailure(`${label}.path must end with the command name.`, { label });
  }
  if (
    declaredPath &&
    inheritedPath.length > 0 &&
    !inheritedPath.every((token, index) => declaredPath[index] === token)
  ) {
    helpFailure(`${label}.path must extend its parent command path.`, {
      label,
    });
  }
  const children = commandChildren(node, label);
  if (children.length === 0 && commandPath.length > 0) {
    const pathText = commandPath.join(" ");
    if (found.has(pathText)) {
      helpFailure(`Duplicate command path: ${pathText}.`, {
        command_path: commandPath,
      });
    }
    found.set(pathText, {
      path: [...commandPath],
      path_text: pathText,
    });
    return;
  }
  for (const [index, child] of children.entries()) {
    visitCommand(
      child,
      commandPath,
      found,
      `${label}.${Object.keys(node).find((key) => node[key] === children)}[${index}]`,
    );
  }
}

export function buildCommandIndex(helpJson) {
  let rootCommands;
  let rootLabel;
  if (Array.isArray(helpJson)) {
    rootCommands = helpJson;
    rootLabel = "help-json";
  } else {
    assertPlainObject(helpJson, "help-json");
    if (
      !Object.hasOwn(helpJson, "commands") ||
      !Array.isArray(helpJson.commands)
    ) {
      helpFailure("help-json.commands must be an array.", {
        label: "help-json.commands",
      });
    }
    if (
      helpJson.name !== undefined &&
      (typeof helpJson.name !== "string" || helpJson.name.length === 0)
    ) {
      helpFailure("help-json.name must be a non-empty string.", {
        label: "help-json.name",
      });
    }
    rootCommands = helpJson.commands;
    rootLabel = "help-json.commands";
  }
  const found = new Map();
  for (const [index, command] of rootCommands.entries()) {
    visitCommand(command, [], found, `${rootLabel}[${index}]`);
  }
  return { commands: [...found.values()].sort(comparePath) };
}

function inspectOptionShape(leafHelp, semantic, flag, expected) {
  const escapedFlag = flag.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const flagPattern = new RegExp(
    `(?:^|[\\s,])${escapedFlag}(?=$|[\\s=,])`,
    "u",
  );
  const line = leafHelp.split(/\r?\n/u).find((candidate) =>
    flagPattern.test(candidate));
  if (!line) {
    return expected.required
      ? {
        semantic,
        flag,
        reason: "required-option-missing",
      }
      : null;
  }
  const flagIndex = line.indexOf(flag);
  const tail = line.slice(flagIndex + flag.length);
  let actualForm = "standalone";
  let hasValue = false;
  if (tail.startsWith("=")) {
    actualForm = "equals";
    hasValue = /^(?:=)(?:<[^>]+>|\[[^\]]+\]|[A-Z][A-Z0-9_-]*)/u
      .test(tail);
  } else {
    const valueMatch = tail.match(
      /^\s+(<[^>]+>|\[[^\]]+\]|[A-Z][A-Z0-9_-]*)(?:\s|$)/u,
    );
    if (valueMatch) {
      actualForm = "separate";
      hasValue = true;
    }
  }
  if (expected.arity === "value" && !hasValue) {
    return { semantic, flag, reason: "value-required", actual_form: actualForm };
  }
  if (expected.arity === "boolean" && hasValue) {
    return {
      semantic,
      flag,
      reason: "boolean-must-not-take-value",
      actual_form: actualForm,
    };
  }
  if (!expected.allowed_forms.includes(actualForm)) {
    return {
      semantic,
      flag,
      reason: "option-form-not-allowed",
      actual_form: actualForm,
      allowed_forms: expected.allowed_forms,
    };
  }
  return null;
}

function usageShape(operation, leafHelp) {
  const usage = leafHelp.match(/^Usage:\s*(.+)$/imu)?.[1] ?? "";
  if (usage.length === 0) {
    return {
      usage_present: false,
      command_path_matches: false,
      expected_positionals: [...operation.positional_args],
      observed_positionals: [],
      positionals_match: false,
    };
  }
  const usageTokens = usage.split(/\s+/u).filter(Boolean);
  const commandPath = operation.command_path;
  const programIndex = usageTokens.findIndex((token) =>
    token.split(/[\\/]/u).at(-1) === "octopus-cli");
  const commandStart = programIndex + 1;
  const commandPathMatches =
    programIndex >= 0 &&
    commandPath.every((segment, offset) =>
      usageTokens[commandStart + offset] === segment);
  const commandEnd = commandPathMatches
    ? commandStart + commandPath.length
    : -1;
  const observedPositionals = [];
  if (commandPathMatches) {
    const tail = usageTokens.slice(commandEnd);
    for (let index = 0; index < tail.length; index += 1) {
      const token = tail[index];
      if (token.startsWith("--")) {
        if (tail[index + 1]?.startsWith("<")) index += 1;
        continue;
      }
      if (token.toLowerCase() === "[options]") continue;
      if (
        (token.startsWith("<") && token.endsWith(">")) ||
        (token.startsWith("[") && token.endsWith("]"))
      ) {
        observedPositionals.push(token);
      }
    }
  }
  const expectedPositionals = [...operation.positional_args];
  return {
    usage_present: true,
    command_path_matches: commandPathMatches,
    expected_positionals: expectedPositionals,
    observed_positionals: observedPositionals,
    positionals_match:
      JSON.stringify(expectedPositionals) ===
      JSON.stringify(observedPositionals),
  };
}

function leafHelpCompatibility(operation, leafHelp) {
  if (typeof leafHelp !== "string") {
    return {
      compatible: false,
      missing_options: Object.values(operation.options),
      option_conflicts: [],
      usage_present: false,
      command_path_matches: false,
      expected_positionals: [...operation.positional_args],
      observed_positionals: [],
      positionals_match: false,
      reason: "Leaf help evidence is missing.",
    };
  }
  const visibleFlags = new Set(
    [...leafHelp.matchAll(/(?:^|\s)(--[a-z0-9][a-z0-9-]*)\b/giu)]
      .map((match) => match[1]),
  );
  const required = [...new Set(
    Object.entries(operation.options)
      .filter(([semantic]) => operation.option_shape[semantic].required)
      .map(([, flag]) => flag),
  )];
  const missingOptions = required.filter((flag) => !visibleFlags.has(flag));
  const usage = usageShape(operation, leafHelp);
  const optionConflicts = Object.entries(operation.options)
    .map(([semantic, flag]) =>
      inspectOptionShape(
        leafHelp,
        semantic,
        flag,
        operation.option_shape[semantic],
      ))
    .filter(Boolean);
  const compatible =
    missingOptions.length === 0 &&
    optionConflicts.length === 0 &&
    usage.usage_present &&
    usage.command_path_matches &&
    usage.positionals_match;
  return {
    compatible,
    missing_options: missingOptions,
    option_conflicts: optionConflicts,
    usage_present: usage.usage_present,
    command_path_matches: usage.command_path_matches,
    expected_positionals: usage.expected_positionals,
    observed_positionals: usage.observed_positionals,
    unexpected_positionals:
      operation.positional_args.length === 0
        ? usage.observed_positionals
        : [],
    visible_options: [...visibleFlags].sort(),
    reason:
      compatible
        ? null
        : "Leaf help does not match the option and positional shape required by the Kit contract.",
  };
}

function bodyProbeCompatibility(operation, bodyProbe) {
  if (!bodyProbe) return null;
  const expectedMarker = bodyProbe?.body?.__aiworker_fde_cli_body_probe__;
  const compatible =
    bodyProbe.dryrun === true &&
    bodyProbe.method &&
    expectedMarker === true;
  return {
    compatible,
    status: compatible ? "body-forwarded" : "body-missing",
    reason: compatible
      ? null
      : "Global dryrun execution did not echo the body probe marker.",
  };
}

function isUncatalogedWrite(command, registeredPaths) {
  if (registeredPaths.has(command.path_text)) return false;
  const normalized = command.path.map((segment) => segment.toLowerCase());
  const leaf = normalized.at(-1);
  if (READ_ONLY_LEAF_VERBS.has(leaf)) return false;
  if (normalized.some((segment) => WRITE_WORDS.has(segment))) return true;
  return true;
}

export function evaluateOperationCatalog(
  catalog,
  commandIndex,
  leafHelp,
  bodyProbes = new Map(),
) {
  assertCatalog(catalog);
  const issues = [];
  const commands = new Set(
    commandIndex.commands.map(({ path_text: pathText }) => pathText),
  );
  const registeredPaths = new Set(
    catalog.supported.map(({ command_path: commandPath }) =>
      commandPath.join(" ")),
  );
  const operations = [];

  for (const operation of catalog.supported) {
    const pathText = operation.command_path.join(" ");
    const present = commands.has(pathText);
    if (!present) {
      if (operation.manual_fallback) {
        operations.push({
          operation_id: operation.operation_id,
          status: "manual-required",
          evidence: {
            command_path: [...operation.command_path],
            command_present: false,
            leaf_help_checked: false,
            fallback_executor: operation.manual_fallback.executor,
            manual_artifacts: [
              ...operation.manual_fallback.manual_artifacts,
            ],
          },
        });
        issues.push(issue(
          "WARNING",
          "W_CLI_COMMAND_MANUAL_FALLBACK",
          pathText,
          `The installed CLI does not expose ${operation.operation_id}; use its registered manual fallback.`,
          { operation_id: operation.operation_id },
        ));
        continue;
      }
      operations.push({
        operation_id: operation.operation_id,
        status: "blocked",
        evidence: {
          command_path: [...operation.command_path],
          command_present: false,
          leaf_help_checked: false,
        },
      });
      issues.push(issue(
        "BLOCKER",
        "B_CLI_COMMAND_MISSING",
        pathText,
        `The installed CLI does not expose ${operation.operation_id}.`,
        { operation_id: operation.operation_id },
      ));
      continue;
    }

    const compatibility = leafHelpCompatibility(
      operation,
      leafHelp.get(operation.operation_id),
    );
    const bodyProbe = bodyProbeCompatibility(
      operation,
      bodyProbes.get(operation.operation_id),
    );
    const bodyProbeCompatible = bodyProbe?.compatible !== false;
    const status = compatibility.compatible && bodyProbeCompatible
      ? "supported"
      : bodyProbe?.compatible === false && operation.manual_fallback
        ? "manual-required"
        : "blocked";
    operations.push({
      operation_id: operation.operation_id,
      status,
      evidence: {
        command_path: [...operation.command_path],
        command_present: true,
        leaf_help_checked: true,
        leaf_help_compatible: compatibility.compatible,
        ...(bodyProbe
          ? { dryrun_body_probe: bodyProbe.status }
          : {}),
        ...(status === "manual-required" && operation.manual_fallback
          ? {
            fallback_executor: operation.manual_fallback.executor,
            manual_artifacts: [
              ...operation.manual_fallback.manual_artifacts,
            ],
          }
          : {}),
      },
    });
    if (!compatibility.compatible) {
      issues.push(issue(
        "BLOCKER",
        "B_CLI_CONTRACT_CONFLICT",
        pathText,
        `Leaf help conflicts with the versioned contract for ${operation.operation_id}.`,
        {
          operation_id: operation.operation_id,
          missing_options: compatibility.missing_options,
          option_conflicts: compatibility.option_conflicts,
          usage_present: compatibility.usage_present,
          command_path_matches: compatibility.command_path_matches,
          expected_positionals: compatibility.expected_positionals,
          observed_positionals: compatibility.observed_positionals,
          unexpected_positionals: compatibility.unexpected_positionals,
          visible_options: compatibility.visible_options ?? [],
        },
      ));
    } else if (bodyProbe?.compatible === false) {
      issues.push(issue(
        operation.manual_fallback ? "WARNING" : "BLOCKER",
        operation.manual_fallback
          ? "W_CLI_BODY_PROBE_MANUAL_FALLBACK"
          : "B_CLI_BODY_PROBE_FAILED",
        pathText,
        operation.manual_fallback
          ? `The installed CLI exposes ${operation.operation_id}, but global dryrun evidence shows its body is not forwarded; use its registered manual fallback.`
          : `The installed CLI exposes ${operation.operation_id}, but global dryrun evidence shows its body is not forwarded.`,
        {
          operation_id: operation.operation_id,
          dryrun_body_probe: bodyProbe.status,
          reason: bodyProbe.reason,
        },
      ));
    }
  }

  for (const operation of catalog.manual_required) {
    operations.push({
      operation_id: operation.operation_id,
      status: "manual-required",
      evidence: {
        executor: operation.executor,
        manual_artifacts: [...operation.manual_artifacts],
      },
    });
  }

  const uncatalogedWriteCommands = commandIndex.commands
    .filter((command) => isUncatalogedWrite(command, registeredPaths));
  for (const command of uncatalogedWriteCommands) {
    issues.push(issue(
      "WARNING",
      "W_CLI_UNCATALOGED_WRITE",
      command.path_text,
      "The CLI exposes a write-like command that is not registered in the Kit catalog; it will not be used.",
      { command_path: command.path },
    ));
  }

  return { operations, issues, uncatalogedWriteCommands };
}
