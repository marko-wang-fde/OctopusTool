import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  BASH_PATH,
  runLocalProcess,
} from "../shared/local-process.js";

function sameIdentity(metadata, identity, type) {
  return (
    metadata.dev === identity.dev &&
    metadata.ino === identity.ino &&
    !metadata.isSymbolicLink() &&
    metadata[type]()
  );
}

function checkBashSyntax(bytes, processAdapter) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "aiworker-bash-syntax-"));
  const directoryIdentity = lstatSync(directory);
  const script = path.join(directory, "script.sh");
  const handle = openSync(script, "wx", 0o600);
  try {
    writeFileSync(handle, bytes);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  const scriptIdentity = lstatSync(script);
  let check;
  try {
    check = processAdapter(BASH_PATH, ["-n", script], { shell: false });
  } finally {
    const currentScript = lstatSync(script);
    if (!sameIdentity(currentScript, scriptIdentity, "isFile")) {
      throw new Error("Private Bash syntax script changed before cleanup.");
    }
    unlinkSync(script);
    const currentDirectory = lstatSync(directory);
    if (!sameIdentity(currentDirectory, directoryIdentity, "isDirectory")) {
      throw new Error("Private Bash syntax directory changed before cleanup.");
    }
    rmdirSync(directory);
  }
  return check;
}

export function inspectRenderedDryrunScript(
  actualBytes,
  expectedBytes,
  options = {},
) {
  if (
    !Buffer.isBuffer(actualBytes) ||
    !Buffer.isBuffer(expectedBytes) ||
    !actualBytes.equals(expectedBytes)
  ) {
    return { valid: false, code: "B_ASSEMBLY_SCRIPT_TAMPERED" };
  }
  if (options.skipSyntax === true) return { valid: true, code: null };
  const check = checkBashSyntax(
    actualBytes,
    options.processAdapter ?? options.spawnSync ?? runLocalProcess,
  );
  return check.status === 0
    ? { valid: true, code: null }
    : { valid: false, code: "B_ASSEMBLY_SCRIPT_TAMPERED" };
}
