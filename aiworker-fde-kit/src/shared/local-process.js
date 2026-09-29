import { spawnSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export const BASH_PATH = realpathSync("/bin/bash");

function isPrivateSyntaxScript(script) {
  try {
    const parent = path.dirname(script);
    const parentMetadata = lstatSync(parent);
    const scriptMetadata = lstatSync(script);
    return (
      path.basename(parent).startsWith("aiworker-bash-syntax-") &&
      path.basename(script) === "script.sh" &&
      parentMetadata.isDirectory() &&
      !parentMetadata.isSymbolicLink() &&
      (parentMetadata.mode & 0o777) === 0o700 &&
      scriptMetadata.isFile() &&
      !scriptMetadata.isSymbolicLink() &&
      (scriptMetadata.mode & 0o777) === 0o600
    );
  } catch {
    return false;
  }
}

export function runLocalProcess(command, args, options = {}) {
  if (
    command !== BASH_PATH ||
    !Array.isArray(args) ||
    args.length !== 2 ||
    args[0] !== "-n" ||
    typeof args[1] !== "string" ||
    !args[1].startsWith("/") ||
    !isPrivateSyntaxScript(args[1]) ||
    options.shell !== false
  ) {
    throw new Error("Local process adapter only permits absolute Bash -n checks.");
  }
  return spawnSync(command, args, {
    shell: false,
    stdio: ["ignore", "ignore", "ignore"],
  });
}
