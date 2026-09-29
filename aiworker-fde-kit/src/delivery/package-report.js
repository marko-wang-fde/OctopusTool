import { isExactUtcIsoTimestamp } from "../shared/time.js";

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function validRedaction(value) {
  return (
    plainObject(value) &&
    Object.keys(value).sort().join(",") ===
      "category,path,replacement,source_index" &&
    value.category === "absolute-source-path" &&
    value.path === "fde-project.yaml" &&
    Number.isSafeInteger(value.source_index) &&
    value.source_index >= 0 &&
    value.replacement === `redacted://source/${value.source_index}`
  );
}

function validResults(value) {
  return (
    value === undefined ||
    (
      Array.isArray(value) &&
      value.every((entry) => {
        if (!plainObject(entry)) return false;
        const keys = Object.keys(entry);
        const allowed = new Set([
          "code",
          "details",
          "message",
          "path",
          "severity",
          "status",
        ]);
        return (
          keys.length > 0 &&
          keys.every((key) => allowed.has(key)) &&
          (
            entry.severity === undefined ||
            ["INFO", "WARNING"].includes(entry.severity)
          ) &&
          (
            entry.status === undefined ||
            entry.status === "passed"
          ) &&
          (entry.severity !== undefined || entry.status !== undefined) &&
          ["code", "message", "path"].every((key) =>
            entry[key] === undefined || typeof entry[key] === "string") &&
          (
            entry.details === undefined ||
            plainObject(entry.details)
          )
        );
      })
    )
  );
}

export function isPassingPackageReport(report) {
  const validationKeys = plainObject(report?.validation_result)
    ? Object.keys(report.validation_result).sort().join(",")
    : "";
  if (
    !plainObject(report) ||
    Object.keys(report).sort().join(",") !==
      "kit_commit,package_input_hash,project_slug,scan_policy_hash," +
      "schema_version,status,validated_at,validation_result" ||
    report.schema_version !== 1 ||
    report.status !== "passed" ||
    typeof report.project_slug !== "string" ||
    report.project_slug.length === 0 ||
    !validHash(report.package_input_hash) ||
    !validHash(report.scan_policy_hash) ||
    typeof report.kit_commit !== "string" ||
    !/^[a-f0-9]{40}$/u.test(report.kit_commit) ||
    !isExactUtcIsoTimestamp(report.validated_at) ||
    !plainObject(report.validation_result) ||
    ![
      "blocker_count,redactions,status",
      "blocker_count,redactions,results,status",
    ].includes(validationKeys) ||
    report.validation_result.status !== "passed" ||
    report.validation_result.blocker_count !== 0 ||
    !Array.isArray(report.validation_result.redactions) ||
    !report.validation_result.redactions.every(validRedaction) ||
    !validResults(report.validation_result.results)
  ) {
    return false;
  }
  return true;
}
