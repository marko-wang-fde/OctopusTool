import { constants as fileConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { parseSafeJson } from "./safe-data.js";

const SCHEMA_NAMESPACE =
  "https://schemas.syngy.ai/aiworker-fde-kit/v1";
const DEFAULT_SCHEMA_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../schemas",
);
const officialRegistries = new WeakSet();

export const SCHEMA_IDS = Object.freeze({
  project: `${SCHEMA_NAMESPACE}/project.schema.json`,
  worker: `${SCHEMA_NAMESPACE}/worker.schema.json`,
  arcubase: `${SCHEMA_NAMESPACE}/arcubase.schema.json`,
  assembly: `${SCHEMA_NAMESPACE}/assembly.schema.json`,
  assemblyOperation: `${SCHEMA_NAMESPACE}/assembly-operation.schema.json`,
  skillSetCreatePayload: `${SCHEMA_NAMESPACE}/payloads/skill-set-create.schema.json`,
  skillUploadPayload: `${SCHEMA_NAMESPACE}/payloads/skill-upload.schema.json`,
  employeeSkillsetsSetPayload: `${SCHEMA_NAMESPACE}/payloads/employee-skillsets-set.schema.json`,
  teamPrivateDigiworkerCreatePayload: `${SCHEMA_NAMESPACE}/payloads/team-private-digiworker-create.schema.json`,
  employeeHireCreatePayload: `${SCHEMA_NAMESPACE}/payloads/employee-hire-create.schema.json`,
});

export const SCHEMA_FILES = Object.freeze([
  "project.schema.json",
  "worker.schema.json",
  "arcubase.schema.json",
  "assembly.schema.json",
  "assembly-operation.schema.json",
  "payloads/skill-set-create.schema.json",
  "payloads/skill-upload.schema.json",
  "payloads/employee-skillsets-set.schema.json",
  "payloads/team-private-digiworker-create.schema.json",
  "payloads/employee-hire-create.schema.json",
]);

const OFFICIAL_SCHEMA_IDS = Object.freeze({
  "project.schema.json": SCHEMA_IDS.project,
  "worker.schema.json": SCHEMA_IDS.worker,
  "arcubase.schema.json": SCHEMA_IDS.arcubase,
  "assembly.schema.json": SCHEMA_IDS.assembly,
  "assembly-operation.schema.json": SCHEMA_IDS.assemblyOperation,
  "payloads/skill-set-create.schema.json": SCHEMA_IDS.skillSetCreatePayload,
  "payloads/skill-upload.schema.json": SCHEMA_IDS.skillUploadPayload,
  "payloads/employee-skillsets-set.schema.json":
    SCHEMA_IDS.employeeSkillsetsSetPayload,
  "payloads/team-private-digiworker-create.schema.json":
    SCHEMA_IDS.teamPrivateDigiworkerCreatePayload,
  "payloads/employee-hire-create.schema.json":
    SCHEMA_IDS.employeeHireCreatePayload,
});

export class SchemaRegistryError extends Error {
  constructor(code, reason, details = {}) {
    super(`${reason} (${code})`);
    this.name = "SchemaRegistryError";
    this.code = code;
    this.reason = reason;
    this.details = details;
  }
}

async function listSchemaFiles(schemaRoot, relativeDirectory = "") {
  const directory = path.join(schemaRoot, relativeDirectory);
  let directoryEntries;
  try {
    directoryEntries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new SchemaRegistryError(
      "E_SCHEMA_OFFICIAL_SET",
      "Official schema directory could not be enumerated.",
      {
        directory: relativeDirectory || ".",
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  const schemaFiles = [];
  for (const entry of directoryEntries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    const relativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;
    if (entry.isSymbolicLink()) {
      throw new SchemaRegistryError(
        "E_SCHEMA_PATH",
        "Official schema registry entries must not be symlinks.",
        { path: relativePath },
      );
    }
    if (entry.isDirectory()) {
      schemaFiles.push(...(await listSchemaFiles(schemaRoot, relativePath)));
    } else if (entry.name.endsWith(".schema.json")) {
      schemaFiles.push(relativePath);
    }
  }
  return schemaFiles;
}

function safeSchemaPath(schemaRoot, relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.includes("\u0000") ||
    relativePath.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new SchemaRegistryError(
      "E_SCHEMA_PATH",
      "Schema paths must be safe relative POSIX paths.",
      { path: relativePath },
    );
  }

  const absolutePath = path.resolve(schemaRoot, ...relativePath.split("/"));
  const relativeToRoot = path.relative(path.resolve(schemaRoot), absolutePath);
  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new SchemaRegistryError(
      "E_SCHEMA_PATH",
      "Schema path escapes the registry root.",
      { path: relativePath },
    );
  }
  return absolutePath;
}

async function loadSchemaEntries(schemaRoot, schemaFiles) {
  let canonicalRoot;
  try {
    canonicalRoot = await realpath(schemaRoot);
  } catch (error) {
    throw new SchemaRegistryError(
      "E_SCHEMA_PATH",
      "Schema registry root could not be resolved.",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }

  return Promise.all(
    schemaFiles.map(async (relativePath) => {
      const absolutePath = safeSchemaPath(schemaRoot, relativePath);
      let fileHandle;
      let text;
      try {
        const initialStats = await lstat(absolutePath);
        if (initialStats.isSymbolicLink() || !initialStats.isFile()) {
          throw new Error("Schema entry is not a regular non-symbolic-link file.");
        }
        fileHandle = await open(
          absolutePath,
          fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
        );
        const openedStats = await fileHandle.stat();
        const currentStats = await lstat(absolutePath);
        if (
          !openedStats.isFile() ||
          currentStats.isSymbolicLink() ||
          !currentStats.isFile() ||
          openedStats.dev !== currentStats.dev ||
          openedStats.ino !== currentStats.ino
        ) {
          throw new Error("Schema entry changed while it was being opened.");
        }

        const canonicalPath = await realpath(absolutePath);
        const relativeCanonicalPath = path.relative(
          canonicalRoot,
          canonicalPath,
        );
        if (
          relativeCanonicalPath === ".." ||
          relativeCanonicalPath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativeCanonicalPath)
        ) {
          throw new Error("Canonical schema path escapes the registry root.");
        }
        text = await fileHandle.readFile("utf8");
      } catch (error) {
        throw new SchemaRegistryError(
          "E_SCHEMA_PATH",
          "Schema entry must remain a contained regular file and must not be a symlink.",
          {
            path: relativePath,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      } finally {
        await fileHandle?.close();
      }
      return {
        path: relativePath,
        schema: parseSafeJson(text, relativePath),
      };
    }),
  );
}

function assertOfficialSchemaIds(schemaEntries) {
  const seenIds = new Map();
  for (const { path: schemaPath, schema } of schemaEntries) {
    if (seenIds.has(schema.$id)) {
      throw new SchemaRegistryError(
        "E_SCHEMA_DUPLICATE_ID",
        `Duplicate schema $id: ${schema.$id}.`,
        {
          firstPath: seenIds.get(schema.$id),
          path: schemaPath,
          id: schema.$id,
        },
      );
    }
    seenIds.set(schema.$id, schemaPath);
  }

  for (const { path: schemaPath, schema } of schemaEntries) {
    const expectedId = OFFICIAL_SCHEMA_IDS[schemaPath];
    if (schema.$id !== expectedId) {
      throw new SchemaRegistryError(
        "E_SCHEMA_OFFICIAL_ID",
        `Official schema ${schemaPath} must use its registered absolute HTTPS $id.`,
        { path: schemaPath, expectedId, actualId: schema.$id },
      );
    }
  }
}

export async function loadSchemas(schemaRoot = DEFAULT_SCHEMA_ROOT) {
  const actualFiles = await listSchemaFiles(schemaRoot);
  const expectedFiles = [...SCHEMA_FILES].sort();
  actualFiles.sort();
  const missing = expectedFiles.filter((file) => !actualFiles.includes(file));
  const extra = actualFiles.filter((file) => !expectedFiles.includes(file));
  if (
    actualFiles.length !== expectedFiles.length ||
    missing.length > 0 ||
    extra.length > 0
  ) {
    throw new SchemaRegistryError(
      "E_SCHEMA_OFFICIAL_SET",
      "Official registry must contain exactly the eight registered schemas.",
      { missing, extra },
    );
  }

  const schemaEntries = await loadSchemaEntries(schemaRoot, SCHEMA_FILES);
  assertOfficialSchemaIds(schemaEntries);
  return schemaEntries;
}

function compileSchemas(schemaEntries) {
  const ids = new Map();
  for (const { path: schemaPath, schema } of schemaEntries) {
    if (typeof schema.$id !== "string" || schema.$id.length === 0) {
      throw new SchemaRegistryError(
        "E_SCHEMA_MISSING_ID",
        `Schema ${schemaPath} has no $id.`,
        { path: schemaPath },
      );
    }
    if (ids.has(schema.$id)) {
      throw new SchemaRegistryError(
        "E_SCHEMA_DUPLICATE_ID",
        `Duplicate schema $id: ${schema.$id}.`,
        { firstPath: ids.get(schema.$id), path: schemaPath, id: schema.$id },
      );
    }
    ids.set(schema.$id, schemaPath);
  }

  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    removeAdditional: false,
    strict: true,
    useDefaults: false,
    validateFormats: true,
  });
  addFormats(ajv);

  try {
    for (const { schema } of schemaEntries) ajv.addSchema(schema);
    for (const id of ids.keys()) ajv.getSchema(id);
  } catch (error) {
    throw new SchemaRegistryError(
      "E_SCHEMA_COMPILE",
      "JSON Schema registry could not be compiled.",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }

  const lookupValidator = ajv.getSchema.bind(ajv);
  const getValidator = (schemaId) => {
    try {
      return lookupValidator(schemaId);
    } catch (error) {
      throw new SchemaRegistryError(
        "E_SCHEMA_COMPILE",
        `Schema ${schemaId} could not be compiled.`,
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  };
  const has = Object.freeze((schemaId) => getValidator(schemaId) !== undefined);
  const validate = Object.freeze((schemaId, value) => {
    const validator = getValidator(schemaId);
    if (!validator) {
      throw new SchemaRegistryError(
        "E_SCHEMA_NOT_FOUND",
        `Schema is not registered: ${schemaId}.`,
        { schemaId },
      );
    }
    const valid = validator(value);
    return valid
      ? { valid: true, errors: [] }
      : { valid: false, errors: stableErrors(validator.errors) };
  });

  return Object.freeze({
    ids: Object.freeze([...ids.keys()]),
    has,
    validate,
  });
}

export async function createOfficialSchemaRegistry(...schemaRootOverrides) {
  if (schemaRootOverrides.length > 0) {
    throw new SchemaRegistryError(
      "E_SCHEMA_ROOT_OVERRIDE",
      "The official schema registry root cannot be overridden.",
    );
  }
  const registry = compileSchemas(await loadSchemas(DEFAULT_SCHEMA_ROOT));
  officialRegistries.add(registry);
  return registry;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function stableErrors(errors) {
  return (errors ?? [])
    .map((error) => ({
      instancePath: error.instancePath,
      schemaPath: error.schemaPath,
      keyword: error.keyword,
      message: error.message ?? "",
      params: stableValue(error.params),
    }))
    .sort((left, right) => {
      const leftKey = [
        left.instancePath,
        left.schemaPath,
        left.keyword,
        left.message,
        JSON.stringify(left.params),
      ].join("\u0000");
      const rightKey = [
        right.instancePath,
        right.schemaPath,
        right.keyword,
        right.message,
        JSON.stringify(right.params),
      ].join("\u0000");
      if (leftKey < rightKey) return -1;
      if (leftKey > rightKey) return 1;
      return 0;
    });
}

export function validateSchema(registry, schemaId, value) {
  if (!officialRegistries.has(registry)) {
    throw new SchemaRegistryError(
      "E_SCHEMA_REGISTRY",
      "Validation requires an official schema registry.",
    );
  }
  return registry.validate(schemaId, value);
}
