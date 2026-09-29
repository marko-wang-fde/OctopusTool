#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd -- "$PROJECT_ROOT"

run_octopus_assemble() {
  if [[ "${1-}" == "" ]]; then
    printf '%s\n' 'refusing empty octopus-cli invocation' >&2
    return 1
  fi
  command octopus-cli "$@"
}

run_octopus_assemble_capture() {
  local operation_id output_file
  operation_id="$1"
  shift
  output_file="$AIWORKER_FDE_TMPDIR/outputs/${operation_id//[^A-Za-z0-9_]/_}.json"
  run_octopus_assemble "$@" | tee "$output_file"
}

json_get_first_string() {
  node -e 'const fs=require("fs"); const obj=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const paths=JSON.parse(process.argv[2]); for (const p of paths) { let v=obj; for (const k of p) v = v == null ? undefined : v[k]; if (typeof v === "string" && v.length > 0) { console.log(v); process.exit(0); } } process.exit(1);' "$1" "$2"
}

json_set_string() {
  node -e 'const fs=require("fs"); const file=process.argv[1]; const path=JSON.parse(process.argv[2]); const value=process.argv[3]; const obj=JSON.parse(fs.readFileSync(file,"utf8")); let cursor=obj; for (let i=0;i<path.length-1;i+=1) cursor=cursor[path[i]]; cursor[path[path.length-1]]=value; fs.writeFileSync(file, JSON.stringify(obj,null,2)+"\n");' "$1" "$2" "$3"
}

verify_generated_assemble_calls() {
  local generated_call
  while IFS= read -r generated_call; do
    case "$generated_call" in
      "run_octopus_assemble '--"*)
        printf '%s\n' 'generated call starts with an option instead of an octopus-cli command path' >&2
        return 1
        ;;
      "run_octopus_assemble '"*) ;;
      *)
        printf '%s\n' 'generated call is not routed through run_octopus_assemble' >&2
        return 1
        ;;
    esac
  done < <(grep '^run_octopus_assemble ' "$0" || true)
}

verify_generated_assemble_calls

AIWORKER_FDE_TMPDIR=$(mktemp -d -t aiworker-fde-assemble.XXXXXX)
mkdir -p "$AIWORKER_FDE_TMPDIR/outputs" "$AIWORKER_FDE_TMPDIR/payloads"
cleanup_aiworker_fde_tmpdir() {
  if [[ -n "$AIWORKER_FDE_TMPDIR" && -d "$AIWORKER_FDE_TMPDIR" && "$(basename -- "$AIWORKER_FDE_TMPDIR")" == aiworker-fde-assemble.* ]]; then
    rm -rf -- "$AIWORKER_FDE_TMPDIR"
  fi
}
trap cleanup_aiworker_fde_tmpdir EXIT

run_octopus_assemble 'configure' 'team' 'private-digiworkers' 'add' '--body-file' 'assembly/payloads/team-private-digiworker-create.json' '--json'
