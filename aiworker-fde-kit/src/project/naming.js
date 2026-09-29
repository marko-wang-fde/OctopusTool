import path from "node:path";

import { canonicalBytes, sha256Bytes } from "../shared/canonical.js";

const CUSTOMER_VOCABULARY = new Map([["星河科技", "xinghe"]]);
const SCENARIO_VOCABULARY = new Map([
  ["客户线索收集", "lead-collector"],
]);
const SCENARIO_KEYWORDS = [
  ["归档", "archive"],
  ["巡检", "inspection"],
  ["线索", "lead"],
  ["收集", "collector"],
  ["客户", "customer"],
];
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export class NamingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "NamingError";
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new NamingError(
      "E_PROJECT_NAME_EMPTY",
      `${field} must be a non-empty string.`,
    );
  }
  if (value.includes("\u0000")) {
    throw new NamingError(
      "E_PROJECT_NAME_INVALID",
      `${field} must not contain a null byte.`,
    );
  }
  return value.trim().normalize("NFC");
}

function suggestSlug(customerName, scenario) {
  const knownScenario = SCENARIO_VOCABULARY.get(scenario);
  if (knownScenario) {
    const customer = CUSTOMER_VOCABULARY.get(customerName) ?? "project";
    return `${customer}-${knownScenario}-fde`;
  }

  const keyword =
    SCENARIO_KEYWORDS.find(([chinese]) => scenario.includes(chinese))?.[1] ??
    "workflow";
  const stableHash = sha256Bytes(
    canonicalBytes({ customer_name: customerName, scenario }),
  ).slice(0, 8);
  return `project-${keyword}-${stableHash}-fde`;
}

export function suggestProjectIdentity(options) {
  const customerName = requiredText(options.customerName, "customerName");
  const scenario = requiredText(options.scenario, "scenario");
  const parent = requiredText(options.parent, "parent");
  if (!path.isAbsolute(parent)) {
    throw new NamingError(
      "E_PROJECT_PARENT_RELATIVE",
      "parent must be an absolute path.",
    );
  }

  const name =
    options.name === undefined
      ? `${customerName}${scenario}数字员工`
      : requiredText(options.name, "name");
  const slug =
    options.slug === undefined
      ? suggestSlug(customerName, scenario)
      : requiredText(options.slug, "slug");
  if (!SAFE_SLUG.test(slug) || slug === "." || slug === "..") {
    throw new NamingError(
      "E_PROJECT_SLUG_INVALID",
      "slug must contain only lowercase ASCII letters, digits, and single hyphens.",
    );
  }

  const absoluteParent = path.resolve(parent);
  const absolutePath = path.resolve(absoluteParent, slug);
  if (path.dirname(absolutePath) !== absoluteParent) {
    throw new NamingError(
      "E_PROJECT_PATH_ESCAPE",
      "The suggested project path must be a direct child of parent.",
    );
  }

  return { name, slug, absolutePath };
}
