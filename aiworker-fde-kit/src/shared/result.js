const SEVERITY_ORDER = {
  BLOCKER: 0,
  WARNING: 1,
  INFO: 2,
};

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function issue(severity, code, path, message, details = {}) {
  return { severity, code, path, message, details };
}

export function commandResult(issues, data = {}) {
  const sortedIssues = [...issues].sort(
    (left, right) =>
      (SEVERITY_ORDER[left.severity] ?? Number.MAX_SAFE_INTEGER) -
        (SEVERITY_ORDER[right.severity] ?? Number.MAX_SAFE_INTEGER) ||
      compareText(left.path, right.path) ||
      compareText(left.code, right.code),
  );

  return {
    exitCode: sortedIssues.some(({ severity }) => severity === "BLOCKER") ? 1 : 0,
    issues: sortedIssues,
    data,
  };
}
