import { readFile, readlink } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { walkRepositoryEntries } from "./file-walker.js";

function schemaIssue(issue, schemaPath, error) {
  return issue(
    "BLOCKER",
    "B_SCHEMA_INVALID",
    schemaPath,
    "JSON Schema cannot be compiled.",
    { error: error instanceof Error ? error.message : String(error) },
  );
}

export async function validateRepositorySchemas(root, { issue }) {
  const candidates = (await walkRepositoryEntries(root, "schemas")).filter(
    (entry) => entry.path.endsWith(".schema.json"),
  );
  const schemaEntries = [];
  const issues = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const registeredSchemas = [];
  addFormats(ajv);

  for (const entry of candidates) {
    if (entry.type === "symlink") {
      const linkTarget = await readlink(path.join(root, entry.path));
      issues.push(
        issue(
          "BLOCKER",
          "B_SCHEMA_SYMLINK",
          entry.path,
          "Repository schemas must be regular files, not symbolic links.",
          { linkTarget },
        ),
      );
    } else if (entry.type === "file") {
      schemaEntries.push(entry);
    } else {
      issues.push(
        issue(
          "BLOCKER",
          "B_SCHEMA_TYPE",
          entry.path,
          "Repository schemas must be regular files.",
          { actualType: entry.type },
        ),
      );
    }
  }

  for (const { path: schemaPath } of schemaEntries) {
    try {
      const contents = await readFile(path.join(root, schemaPath), "utf8");
      ajv.addSchema(JSON.parse(contents), schemaPath);
      registeredSchemas.push(schemaPath);
    } catch (error) {
      issues.push(schemaIssue(issue, schemaPath, error));
    }
  }

  for (const schemaPath of registeredSchemas) {
    try {
      ajv.getSchema(schemaPath);
    } catch (error) {
      issues.push(schemaIssue(issue, schemaPath, error));
    }
  }

  return issues;
}
