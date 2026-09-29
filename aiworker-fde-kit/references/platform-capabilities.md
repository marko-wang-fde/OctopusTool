# Platform capability selection

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0 and public capability catalog revision 2026-07-24
Source: Public AIWorker capability guidance and sanitized platform snapshots; no private deployment inventory.

## Sources and evidence

Use `catalog/toolkit-keys.yaml` as the public machine fact source for toolkit key spelling, public status, risk, source version, and evidence. Do not infer a toolkit key from prose, examples, installed CLI commands, or `octopus-cli --help-json`.

Use this reference for design judgment only. A key in the public catalog does not prove it is enabled in a target Team. If the user authorizes a read-only target capability check, compare the result with the public catalog and retain both evidence layers.

## Selection method

For each employee:

1. Derive an observable job action from a confirmed scenario.
2. Identify the minimum capability domain required for that action.
3. Select only keys present in the public catalog.
4. Record the Skill that uses each key and the acceptance evidence it enables.
5. Record prerequisites, identity, data scope, risk, and human check.
6. Remove keys with no concrete Skill action or acceptance case.

Unknown keys are blockers. Public keys absent from an authorized target-Team inventory are environment blockers. A CLI command with a similar name is not toolkit evidence.

## Capability boundaries

- **Structured business data**: give business employees user-level Arcubase access; keep administration with authorized delivery/admin roles.
- **Organization**: use view capability for role/recipient resolution; restrict membership or role changes.
- **Scheduling**: scheduling triggers work but does not deliver a message.
- **External messaging**: resolve an explicitly bound recipient, handle delivery failure, and add human review for high-impact content.
- **Identity verification**: use for externally reachable sensitive workflows; an employee guides the platform flow and never invents identity.
- **Task coordination**: use durable task state when work spans people, employees, time, or offline actions.
- **Search/fetch**: retain sources and timestamps; do not turn public information into unreviewed high-risk decisions.
- **Browser/compute/shell**: constrain environment, data, and action scope; provide takeover or stop behavior.
- **Content generation**: define brand, copyright, privacy, artifact, and approval evidence.
- **System/data/organization/ontology administration**: treat as restricted or critical and keep off ordinary business employees.

## Capability record

For every selected key, record:

- employee and Skill stable IDs;
- business action and expected evidence;
- catalog revision and item status;
- target-Team check status, if any;
- prerequisites and resource scope;
- acting identity and permitted roles;
- risk and human-in-the-loop control;
- failure, refusal, and recovery behavior;
- impacted design, assembly, and acceptance artifacts.

Prefer absence over speculative authorization. If a necessary capability has neither a verified supported operation nor a confirmed administrator-manual route, mark the scenario blocked rather than inventing a platform feature.
