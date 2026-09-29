const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;
const ENCODED_OCTET = /%[0-9a-f]{2}/iu;
const WINDOWS_DRIVE = /^[a-z]:\//iu;

export function isStrictSafeRelativePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    pathIsAbsolute(value) ||
    WINDOWS_DRIVE.test(value) ||
    value.includes("\\") ||
    CONTROL_CHARACTER.test(value) ||
    ENCODED_OCTET.test(value)
  ) {
    return false;
  }
  const segments = value.split("/");
  return segments.every((segment) =>
    segment.length > 0 && segment !== "." && segment !== "..");
}

function pathIsAbsolute(value) {
  return value.startsWith("/");
}
