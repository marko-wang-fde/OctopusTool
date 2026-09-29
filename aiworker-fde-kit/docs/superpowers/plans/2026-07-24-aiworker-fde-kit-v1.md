# AIWorker FDE Kit V1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可被 Codex 与 Claude Code 安装的 FDE 主控 Skill，使工程师能设计 AIWorker 数字员工团队，并生成、校验和打包完整的离线交付包。

**Architecture:** 仓库以根 `SKILL.md` 为唯一编排入口，按需加载参考库、模板与版本化契约。Node.js 20 工具链负责确定性初始化、Schema/交叉引用校验、CLI 能力探测、仅 dry-run 脚本渲染、离线打包和事务化安装；所有平台事实通过目录与 Schema 注入，工具不得执行正式写操作。

**Tech Stack:** Markdown/YAML/JSON Schema Draft 2020-12、Node.js 20 ESM、Ajv 8、`yaml`、`json-canonicalize`、Vitest、GitHub Actions、Shell 启动器。

---

## 实施约束

- 实施每一任务前使用 `@superpowers:test-driven-development`，严格按红—绿—重构推进。
- 完成每一任务后只提交该任务列出的文件；不要把后续任务或无关工作树修改带入提交。
- 改动 `SKILL.md` 或参考资料时遵循 `@skill-creator` 与 `@superpowers:writing-skills`。
- 每个脚本必须支持 `--help`；成功退出 `0`，业务/契约失败退出 `1`，参数错误退出 `2`，依赖、文件系统、CLI 或未分类运行时错误退出 `3`。
- 测试禁止访问真实租户、真实 Profile、网络或开发机全局 `octopus-cli`，除明确标为兼容性测试的命令。
- V1 到“生成并校验完整离线交付包”为止；不得实现正式平台装配、真实写请求或自动全局安装 `octopus-cli`。

## 文件职责图

```text
SKILL.md                                  七阶段工作流、四道闸门、参考路由和安全边界
agents/openai.yaml                        Codex 展示元数据
references/*.md                           FDE、平台、员工、Skill、Arcubase、权限、CLI、验收知识
references/conditional-topics/*.md        仅在触发条件成立时加载的专题设计规则
catalog/toolkit-keys.yaml                 公开 toolkitKey 唯一机器事实源
catalog/assembly-operations.yaml          稳定 operation_id 到 CLI/人工路径的唯一映射
catalog/stage-artifacts.yaml              七阶段权威输入、输出、依赖和审批映射
schemas/*.schema.json                     项目、员工、Arcubase、装配结构契约
schemas/payloads/*.schema.json            三种受支持写操作的 Payload 契约
assets/project-template/**                客户项目固定骨架与可读模板
assets/examples/lead-collector/**         无真实数据的确定性金标准、CLI 桩和期望清单
src/commands/*.js                         七个脚本入口的参数解析和退出码适配
src/project/*.js                          初始化、清单、产物矩阵、阶段哈希与状态派生
src/contracts/*.js                        安全 YAML、Schema、目录和交叉引用校验
src/assembly/*.js                         CLI 探测、装配契约解析和 dry-run 渲染
src/delivery/*.js                         文件选择、敏感扫描、包清单与 ZIP 事务
src/install/*.js                          安装快照、预检、事务提交和回滚
src/shared/*.js                           RFC 8785、SHA-256、路径排序、原子文件操作
scripts/*                                 可执行 Node 启动器，不包含业务逻辑
test/unit/**                              单一模块快速测试
test/integration/**                       命令、目录、事务和失败矩阵测试
test/fixtures/**                          最小恶意/边界夹具，不含客户数据
.github/workflows/ci.yml                  离线确定性 CI 与单独的已安装 CLI 兼容性检查
```

## Chunk 1: 仓库契约、Skill 与项目骨架

### Task 1: 建立 Node 工具链与仓库质量门

**Files:**

- Create: `package.json`
- Create: `package-lock.json`
- Create: `.gitignore`
- Create: `vitest.config.js`
- Create: `src/shared/result.js`
- Create: `test/unit/shared/result.test.js`
- Create: `scripts/check-repository`
- Create: `src/commands/check-repository.js`
- Create: `test/integration/check-repository.test.js`

- [ ] **Step 1: 先建立可运行的测试工具链**

先写入以下 `package.json`：

```json
{
  "name": "@syngy/aiworker-fde-kit",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "lint:repo": "./scripts/check-repository",
    "verify": "npm run test:run && npm run lint:repo"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "json-canonicalize": "^1.0.6",
    "yaml": "^2.8.0"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

`.gitignore` 精确包含：

```text
node_modules/
coverage/
.DS_Store
.tmp/
test-output/
```

`vitest.config.js` 使用 `defineConfig`，设置 `test.include: ["test/**/*.test.js"]`、`test.fileParallelism: false` 和 `test.restoreMocks: true`，防止文件系统事务测试相互影响。

Run: `npm install`

Expected: 生成 `package-lock.json`，`npm exec vitest -- --version` 成功输出版本。

- [ ] **Step 2: 写退出结果对象的失败测试**

在 `test/unit/shared/result.test.js` 写出完整行为：

```js
import { describe, expect, it } from "vitest";
import { issue, commandResult } from "../../../src/shared/result.js";

describe("result contract", () => {
  it("sorts issues deterministically and derives exit code", () => {
    const result = commandResult([
      issue("WARNING", "W_Z", "z/file", "later"),
      issue("BLOCKER", "B_A", "a/file", "first"),
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.issues.map(({ code }) => code)).toEqual(["B_A", "W_Z"]);
  });
});
```

- [ ] **Step 3: 运行测试并确认红灯**

Run: `npm test -- --run test/unit/shared/result.test.js`

Expected: FAIL，提示 `src/shared/result.js` 不存在。

- [ ] **Step 4: 实现最小结果契约**

`issue(severity, code, path, message, details = {})` 返回纯 JSON 对象；`commandResult(issues, data = {})` 按 `severity(BLOCKER, WARNING, INFO) + path + code` 排序，有 `BLOCKER` 时 `exitCode: 1`，否则为 `0`。不得在库函数中调用 `process.exit`。

- [ ] **Step 5: 添加仓库检查命令的失败测试**

在 `test/integration/check-repository.test.js` 创建临时仓库夹具，分别断言：

- 缺少根 `SKILL.md` 时返回 `B_SKILL_MISSING`。
- 脚本不是 `0755` 时返回 `B_SCRIPT_MODE`。
- JSON Schema 不能被 Ajv 编译时返回 `B_SCHEMA_INVALID`。
- Markdown 相对链接不存在时返回 `B_LINK_BROKEN`。
- 合法最小夹具退出 `0`。
- `--help` 输出 usage 并退出 `0`；未知参数退出 `2`。
- 不可读根目录或依赖加载失败映射为退出 `3`，stdout 仍为合法 JSON。

- [ ] **Step 6: 运行命令测试并确认红灯**

Run: `npm test -- --run test/integration/check-repository.test.js`

Expected: FAIL，提示命令模块或启动器不存在。

- [ ] **Step 7: 实现仓库检查和固定 npm 命令**

`scripts/check-repository` 只做 `exec node "$SCRIPT_DIR/../src/commands/check-repository.js" "$@"`。命令检查根文件、可执行位、Schema 可编译性和本地链接；输出一份 JSON 结果到 stdout。命令层捕获运行时异常并映射到 `3`，库函数仍不调用 `process.exit`。

- [ ] **Step 8: 验证**

Run: `npm run test:run -- test/unit/shared/result.test.js test/integration/check-repository.test.js`

Expected: 2 个测试文件全部 PASS。

- [ ] **Step 9: 提交**

```bash
git add package.json package-lock.json .gitignore vitest.config.js src/shared/result.js src/commands/check-repository.js scripts/check-repository test/unit/shared/result.test.js test/integration/check-repository.test.js
git commit -m "build: establish deterministic node toolchain"
```

### Task 2: 编写主控 Skill、参考路由与能力目录

**Files:**

- Create: `SKILL.md`
- Create: `agents/openai.yaml`
- Create: `references/fde-methodology.md`
- Create: `references/platform-capabilities.md`
- Create: `references/worker-model.md`
- Create: `references/skill-authoring.md`
- Create: `references/arcubase-design.md`
- Create: `references/identity-and-access.md`
- Create: `references/octopus-cli.md`
- Create: `references/acceptance.md`
- Create: `references/conditional-topics/taskboard.md`
- Create: `references/conditional-topics/browser-and-webskill.md`
- Create: `references/conditional-topics/ontos.md`
- Create: `references/conditional-topics/a2ui.md`
- Create: `references/conditional-topics/external-station.md`
- Create: `references/conditional-topics/private-service.md`
- Create: `catalog/toolkit-keys.yaml`
- Create: `catalog/assembly-operations.yaml`
- Create: `LICENSE`
- Create: `test/integration/skill-contract.test.js`
- Create: `test/integration/catalog-contract.test.js`

- [ ] **Step 1: 写 Skill 契约失败测试**

测试解析 frontmatter，并精确断言：

- `name: design-aiworker-solutions`。
- description 同时覆盖“设计数字员工/团队”“生成离线交付包”“接续 FDE 项目”。
- 正文包含七个稳定阶段 ID、四道人审闸门以及禁止正式写操作。
- 每个阶段列出要读取的参考文件，所有链接均存在。
- 主文件不复制大段 CLI 参数表或 toolkitKey 清单。
- `agents/openai.yaml` 含唯一顶层 `interface`，其中 `display_name: "AIWorker FDE Kit"`、不超过 80 字符的 `short_description`，以及明确触发 `$design-aiworker-solutions` 的 `default_prompt`。
- 每份参考都含更新时间、适用版本和公开或脱敏来源说明；仅超过 100 行的参考额外要求顶部目录。

- [ ] **Step 2: 写目录契约失败测试**

测试 `toolkit-keys.yaml` 顶层含非空 `catalog_version`、`source_revision`、ISO 日期 `verified_at`；每项 key 唯一、格式为 `feat.[a-z0-9_]+`、状态枚举合法，并含来源版本、`risk_level` 和证据说明。测试 `assembly-operations.yaml` 的 operation ID 唯一，并固定包含：

```yaml
supported:
  - skill-set.create
  - team-private-digiworker.create
  - employee-hire.create
manual_required:
  - skill-package.upload
  - arcubase-app.create
  - arcubase-table.create
```

受支持写操作必须有命令路径、参数/选项、Payload Schema URI、风险和契约版本；人工操作不得有伪 CLI 字段，并必须有非空 `manual_artifacts`、`manual_instructions` 和恢复条件。

- [ ] **Step 3: 运行测试并确认红灯**

Run: `npm test -- --run test/integration/skill-contract.test.js test/integration/catalog-contract.test.js`

Expected: FAIL，提示根 Skill、参考或目录不存在。

- [ ] **Step 4: 编写主控 Skill**

根 `SKILL.md` 仅写触发条件、三种入口、项目名/slug/绝对路径确认、七阶段输入输出、四道闸门、按需参考路由、失败边界和结束条件。创建 `agents/openai.yaml` 并逐字段满足 Step 1 的 Codex manifest 契约。明确：

- 新建、资料驱动、接续项目均先建议名称和目录并等待确认。
- 第一版只生成并校验完整离线交付包。
- 只能生成带 `--dryrun` 的 CLI Shell。
- 缺失 CLI 时给安装指引，不自动安装。
- 普通 Skill 上传与 Arcubase 建表为人工装配。

- [ ] **Step 5: 编写核心方法与平台参考**

编写 `fde-methodology.md`、`platform-capabilities.md`、`worker-model.md`、`skill-authoring.md`、`arcubase-design.md`、`identity-and-access.md`、`octopus-cli.md` 和 `acceptance.md`。从已批准规范的公开/脱敏内容形成独立参考；每份都写更新时间、适用版本与来源说明，超过 100 行时再在顶部加目录。`octopus-cli.md` 必须区分命令存在性、版本化参数契约、叶子帮助和 dry-run 四层证据。

- [ ] **Step 6: 编写条件专题、机器目录和许可证**

六份条件专题分别给出触发条件、必需设计问题、交付影响、权限/风险和退出检查。写入两份 YAML 目录并满足 Step 2 的机器契约。Apache-2.0 正文写入 `LICENSE`。

- [ ] **Step 7: 运行质量检查**

Run: `npm test -- --run test/integration/skill-contract.test.js test/integration/catalog-contract.test.js`

Expected: 全部 PASS。

Run: `npm run lint:repo`

Expected: exit `0`，JSON 中 `issues: []`。

- [ ] **Step 8: 提交**

```bash
git add SKILL.md agents references catalog LICENSE test/integration/skill-contract.test.js test/integration/catalog-contract.test.js
git commit -m "feat: define fde orchestration skill and catalogs"
```

### Task 3: 定义 Schema、项目模板和安全解析器

**Files:**

- Create: `schemas/project.schema.json`
- Create: `schemas/worker.schema.json`
- Create: `schemas/arcubase.schema.json`
- Create: `schemas/assembly.schema.json`
- Create: `schemas/assembly-operation.schema.json`
- Create: `schemas/payloads/skill-set-create.schema.json`
- Create: `schemas/payloads/team-private-digiworker-create.schema.json`
- Create: `schemas/payloads/employee-hire-create.schema.json`
- Create: `src/contracts/safe-data.js`
- Create: `src/contracts/schema-registry.js`
- Create: `src/shared/canonical.js`
- Create: `test/unit/contracts/safe-data.test.js`
- Create: `test/unit/contracts/schema-registry.test.js`
- Create: `test/unit/shared/canonical.test.js`
- Create: `assets/project-template/fde-project.yaml`
- Create: `assets/project-template/.gitignore`
- Create: `assets/project-template/template-inventory.yaml`
- Create: `assets/project-template/inputs/input-inventory.md`
- Create: `assets/project-template/discovery/facts-and-assumptions.md`
- Create: `assets/project-template/discovery/open-questions.md`
- Create: `assets/project-template/discovery/scenario-model.md`
- Create: `assets/project-template/design/team-design.md`
- Create: `assets/project-template/design/collaboration-and-dataflow.md`
- Create: `assets/project-template/design/platform-capability-selection.md`
- Create: `assets/project-template/design/data-foundation.md`
- Create: `assets/project-template/design/identity-and-access.md`
- Create: `assets/project-template/design/external-station.md`
- Create: `assets/project-template/design/taskboard.md`
- Create: `assets/project-template/design/browser-webskill.md`
- Create: `assets/project-template/arcubase/decision.yaml`
- Create: `assets/project-template/assembly/assembly-plan.md`
- Create: `assets/project-template/assembly/operations.yaml`
- Create: `assets/project-template/acceptance/acceptance-plan.md`
- Create: `assets/project-template/acceptance/test-cases.yaml`
- Create: `assets/project-template/reports/validation-report.md`
- Create: `assets/project-template/delivery-summary.md`
- Create: `test/integration/project-template-contract.test.js`

- [ ] **Step 1: 写安全 YAML 与规范化失败测试**

覆盖 YAML tag、anchor、merge key、非字符串对象 key、`Infinity`/`NaN` 被拒绝；普通 YAML/JSON 转为纯 JSON 数据模型。断言 RFC 8785 canonical bytes 的 SHA-256、数组顺序保留、UTF-8 路径排序以及 Markdown LF/行尾空白规范化。

- [ ] **Step 2: 运行解析器测试并确认红灯**

Run: `npm test -- --run test/unit/contracts/safe-data.test.js test/unit/shared/canonical.test.js`

Expected: FAIL，提示解析和规范化模块不存在。

- [ ] **Step 3: 实现安全解析与 canonical 工具**

`safe-data.js` 只接受 JSON 数据模型；解析前扫描 YAML AST 并拒绝自定义 tag、alias、anchor、merge 和非 string key。`canonical.js` 暴露 `canonicalBytes`、`sha256Bytes`、`normalizeMarkdown`、`sortRelativePaths`，不承担文件遍历。

- [ ] **Step 4: 写 Schema registry 与真实模板失败测试**

测试五个顶层 Schema 和三个 Payload Schema 均为 Draft 2020-12、`additionalProperties: false` 用于核心 envelope、URI 唯一。用最小合法/非法对象覆盖：

- 七阶段状态和依赖。
- `data_foundation.tables` 唯一表事实源。
- `supported`、`manual-required`、`blocked` 三种互斥 envelope。
- 写操作恰好一个 Payload 引用。
- `mode: none` 时表为空。

同时先写 `project-template-contract.test.js`：安全解析 `template-inventory.yaml`，断言其 `fixed` 精确列出初始化骨架，且 `conditional` 精确映射：

```yaml
conditional:
  external-station:
    trigger: workers[].station_reachable == true
    source: design/external-station.md
    target: design/external-station.md
  taskboard:
    trigger: capabilities[] contains feat.taskboard
    source: design/taskboard.md
    target: design/taskboard.md
  browser-webskill:
    trigger: capabilities[] contains browser-or-webskill
    source: design/browser-webskill.md
    target: design/browser-webskill.md
```

测试再枚举这些文件，安全解析全部 YAML，用尚未实现的 Schema registry 校验 `fde-project.yaml`、Arcubase decision、operations 和 acceptance cases，并断言 Markdown 非空且没有未定义模板变量。此处只验证模板库存和适用条件元数据，不调用尚未实现的初始化器。

- [ ] **Step 5: 运行 Schema 与模板测试并确认红灯**

Run: `npm test -- --run test/unit/contracts/schema-registry.test.js test/integration/project-template-contract.test.js`

Expected: FAIL，提示 Schema 缺失或不能编译。

- [ ] **Step 6: 实现 Schema 与模板**

Schema 中固定稳定 ID 格式、枚举、引用和条件约束。模板只提供完整结构和明确的 `not-applicable` 位置，不放客户示例数据；`.gitignore` 至少包含 `inputs/source-files/`、`reports/backups/`、`.tmp/`、`.env*`、`generated/`、`delivery/*.zip`。三个条件专题模板分别只包含 External Station、Taskboard、Browser/WebSkill 的触发事实、设计、权限风险与验收章节。`template-inventory.yaml` 是主 Skill 物化模板和校验器判定适用性的共同映射；初始化器只复制 `fixed`，方案阶段由主 Skill按上述 trigger 复制对应 `source` 到 `target`。

- [ ] **Step 7: 运行真实模板契约测试**

`project-template-contract.test.js` 必须通过，并输出固定核心模板集合与三个条件模板各自的触发条件。初始化实际复制行为留到 Task 4 的命令集成测试，因为该任务才创建初始化器。

Run: `npm test -- --run test/integration/project-template-contract.test.js`

Expected: PASS，固定模板清单和条件模板矩阵均匹配。

- [ ] **Step 8: 验证 Chunk 1**

Run: `npm run verify`

Expected: 所有测试 PASS；仓库检查 exit `0`。

- [ ] **Step 9: 提交**

```bash
git add schemas src/contracts src/shared/canonical.js assets/project-template test/unit/contracts test/unit/shared/canonical.test.js test/integration/project-template-contract.test.js
git commit -m "feat: add project schemas and delivery templates"
```

## Chunk 2: 初始化、校验、CLI 探测与 dry-run

### Task 4: 实现需确认的原子项目初始化

**Files:**

- Create: `scripts/init-project`
- Create: `src/commands/init-project.js`
- Create: `src/project/naming.js`
- Create: `src/project/initialize.js`
- Create: `test/unit/project/naming.test.js`
- Create: `test/integration/init-project.test.js`
- Create: `test/fixtures/source-materials/requirements.txt`
- Create: `test/fixtures/resume-project/fde-project.yaml`
- Create: `test/fixtures/import-project-without-manifest/design/legacy.md`
- Create: `test/fixtures/old-schema-project/fde-project.yaml`

- [ ] **Step 1: 写名称建议失败测试**

断言中文展示名保持用户语义，slug 只含小写 ASCII、数字和连字符；同一输入产生同一建议；不能可靠转写时使用核心场景英文映射而非随机值。

- [ ] **Step 2: 写初始化命令失败测试**

测试两个互斥接口：

```text
init-project --mode new|materials
             --customer <name> --scenario <text> --parent <absolute-dir>
             [--source <path>...] [--source-mode copy|reference]
             [--name <display-name>] [--slug <ascii-slug>] [--confirm]

init-project --mode resume --project <absolute-existing-dir>
             [--confirm-import <proposal-sha256>]
             [--confirm-migration <preview-sha256>]
```

`new/materials` 无 `--confirm` 时只输出包含 `name`、`slug`、`absolute_path`、`entry_mode`、`source_mode` 的建议 JSON，不写文件。带确认时先在同级 staging 创建并 Schema 校验，再原子重命名。`materials` 默认 `--source-mode copy`，`reference` 只记绝对路径并标记不可移植。

`resume` 从不走创建目录流程：合法清单只返回最近有效阶段和哈希差异；无清单时输出 canonical import proposal 及其 SHA-256，只有匹配的 `--confirm-import` 才原子新增清单且不改旧文件；旧 schema 输出 migration preview 及 SHA-256，只有匹配的 `--confirm-migration` 才先备份清单和受影响文件到 `reports/backups/`，再原子迁移；损坏/版本过新零写入。

覆盖目标已存在、materials 复制/只记录路径、resume 合法/无清单/损坏/旧版/版本过新、确认哈希不匹配、注入复制或迁移失败后旧文件不变。初始化器从 Task 3 的 `template-inventory.yaml.fixed` 复制固定骨架，不接受或猜测条件专题。
逐项断言退出码：成功或只预览 `0`；未知参数、互斥参数、相对目录和确认哈希格式错误 `2`；已存在目标或非法项目内容 `1`；源文件缺失/不可读、复制/备份/原子替换失败 `3`。

- [ ] **Step 3: 运行测试并确认红灯**

Run: `npm test -- --run test/unit/project/naming.test.js test/integration/init-project.test.js`

Expected: FAIL，提示初始化模块不存在。

- [ ] **Step 4: 实现最小初始化流程**

将副作用分别封装在 `initializeProject(options, deps)` 与 `resumeProject(options, deps)`；依赖注入时钟、文件系统和哈希函数。新建流程验证 `parent` 为绝对路径，禁止覆盖已存在目录，只复制 `template-inventory.yaml.fixed`，不得写入 `conditional` 条目。资料清单记录原始路径、复制路径、SHA-256、媒体类型、读取状态和复制时间；reference 模式写 `portable: false`。接续流程以预览哈希作为乐观锁，确认时重新计算；不一致即退出 `1` 且零写入。

- [ ] **Step 5: 验证并提交**

Run: `npm test -- --run test/unit/project/naming.test.js test/integration/init-project.test.js`

Expected: 全部 PASS，临时目录测试结束后无 `.tmp-*` 残留。

```bash
git add scripts/init-project src/commands/init-project.js src/project/naming.js src/project/initialize.js test/unit/project test/integration/init-project.test.js test/fixtures/source-materials test/fixtures/resume-project test/fixtures/import-project-without-manifest test/fixtures/old-schema-project
git commit -m "feat: initialize confirmed fde projects atomically"
```

### Task 5: 实现阶段哈希、交叉引用与项目状态校验

**Files:**

- Create: `scripts/validate-project`
- Create: `src/commands/validate-project.js`
- Create: `src/project/artifact-matrix.js`
- Create: `src/project/stage-state.js`
- Create: `catalog/stage-artifacts.yaml`
- Create: `src/contracts/cross-references.js`
- Create: `src/contracts/project-validator.js`
- Create: `test/unit/project/artifact-matrix.test.js`
- Create: `test/unit/project/stage-state.test.js`
- Create: `test/unit/contracts/cross-references.test.js`
- Create: `test/integration/validate-project.test.js`
- Create: `test/fixtures/projects/invalid-cross-reference/fde-project.yaml`
- Create: `test/fixtures/projects/stale-stage/fde-project.yaml`

- [ ] **Step 1: 写固定/条件产物矩阵失败测试**

覆盖所有固定文件和条件文件：Arcubase `none/new/extend`、Station、Taskboard、Browser/WebSkill、dry-run 适用/不适用/阻断。缺少固定文件为 `BLOCKER`，未触发条件文件不得误报。

- [ ] **Step 2: 写阶段状态失败测试**

用固定哈希断言优先级：当前阶段哈希变化 → `needs-review`；下游 → `stale`；依赖不完整 → `stale`；工作标记 → `in-progress`；满足产物、校验和审批 → `complete`。项目状态严格派生为 `draft/reviewable/delivery-ready/cli-dryrun-validated`。

- [ ] **Step 3: 写交叉引用失败测试**

逐个 mutation 断言稳定错误码：

- 员工引用不存在的 Skill：`B_WORKER_SKILL_UNKNOWN`。
- Skill 表写入引用不存在：`B_TABLE_UNKNOWN`。
- Skill 或 Payload 引用不存在字段：`B_FIELD_UNKNOWN`。
- toolkitKey 未登记：`B_TOOLKIT_UNKNOWN`。
- 普通销售全表权限：`B_ACCESS_SCOPE`。
- 写操作缺身份护栏：`B_IDENTITY_GUARD`。
- External Station 可达但缺外部身份核验或访问护栏：`B_STATION_GUARD`。
- promptSpec、员工文档与装配 Payload 的 employee/skill/toolkitKey 不一致：`B_WORKER_PAYLOAD_DRIFT`。
- 员工 Skill 引用包目录外运行时文件：`B_SKILL_RUNTIME_ESCAPE`。
- 高风险动作缺少人在环：`B_HUMAN_GATE_MISSING`。
- 验收未覆盖主要业务动作、拒绝、权限或人在环：`B_ACCEPTANCE_COVERAGE`。

- [ ] **Step 4: 运行测试并确认红灯**

Run: `npm test -- --run test/unit/project test/unit/contracts/cross-references.test.js`

Expected: FAIL，提示矩阵、状态、交叉校验或命令模块不存在。

- [ ] **Step 5: 写命令和阶段接受失败测试**

在尚未实现生产代码前覆盖 `validate-project <project-dir>`、`--accept-stage`、损坏 YAML、未知 schema version、报告 JSON/Markdown 同步、退出码，以及未运行打包验证时 `validate` 不得完成。`catalog/stage-artifacts.yaml` 固定七个阶段的 `depends_on`、`required_inputs`、`required_outputs` 和 `approval_field`；测试逐项断言集合，无 CLI 参数允许调用者传入或缩小哈希路径。

对 `--accept-stage` 断言：未知阶段退出 `2`；缺文件、校验失败、审批缺失或调用者尝试额外 hash 参数时 `fde-project.yaml` 和业务产物零改动，但仍原子写入失败验证报告，包含失败阶段、命令、退出码和恢复建议；命令不创建审批；成功只把当前阶段 revision 精确加一并写全量权威哈希；下游保持 `stale`；重复接受未变化阶段不再递增。

命令退出矩阵必须逐项执行：合法项目 `0`；可读但 Schema/引用/阶段契约非法 `1`；未知 flag、缺参数、未知 stage `2`；项目路径不存在/不可读或报告原子写失败 `3`。验证报告本身写 staging 并原子替换，报告失败不得破坏旧报告。

- [ ] **Step 6: 再运行并确认红灯**

Run: `npm test -- --run test/integration/validate-project.test.js`

Expected: FAIL，提示 `validate-project` 尚未实现。

- [ ] **Step 7: 实现纯函数校验器和阶段接受**

`project-validator.js` 依次执行安全解析、Schema、产物矩阵、目录和跨引用校验，聚合而非首错退出。`stage-state.js` 只从已校验的 `catalog/stage-artifacts.yaml` 取得完整路径集。`--accept-stage <id>` 先校验指定阶段和已有审批，再原子更新当前输入/输出哈希、`baseline_revision + 1` 和状态；禁止自动创建审批、接受下游、接收调用者 hash 列表或静默覆盖用户文件。未变化的已完成阶段幂等成功。

- [ ] **Step 8: 运行测试并提交**

Run: `npm test -- --run test/unit/project test/unit/contracts test/integration/validate-project.test.js`

Expected: 全部 PASS。

```bash
git add scripts/validate-project src/commands/validate-project.js src/project/artifact-matrix.js src/project/stage-state.js src/contracts/cross-references.js src/contracts/project-validator.js catalog/stage-artifacts.yaml test/unit/project test/unit/contracts/cross-references.test.js test/integration/validate-project.test.js test/fixtures/projects
git commit -m "feat: validate fde project invariants and stage state"
```

### Task 6: 实现可注入的 octopus-cli 能力探测

**Files:**

- Create: `scripts/inspect-octopus-cli`
- Create: `src/commands/inspect-octopus-cli.js`
- Create: `src/assembly/cli-runner.js`
- Create: `src/assembly/cli-inspector.js`
- Create: `src/assembly/operation-catalog.js`
- Create: `test/unit/assembly/operation-catalog.test.js`
- Create: `test/integration/inspect-octopus-cli.test.js`
- Create: `test/fixtures/cli/missing-command/npm-package-version.json`
- Create: `test/fixtures/cli/missing-command/cli-version.json`
- Create: `test/fixtures/cli/missing-command/help-json.json`
- Create: `test/fixtures/cli/missing-command/leaf-help/configure-skill-set-add.txt`
- Create: `test/fixtures/cli/help-conflict/npm-package-version.json`
- Create: `test/fixtures/cli/help-conflict/cli-version.json`
- Create: `test/fixtures/cli/help-conflict/help-json.json`
- Create: `test/fixtures/cli/help-conflict/leaf-help/configure-skill-set-add.txt`
- Create: `test/fixtures/cli/valid/npm-package-version.json`
- Create: `test/fixtures/cli/valid/cli-version.json`
- Create: `test/fixtures/cli/valid/help-json.json`
- Create: `test/fixtures/cli/valid/leaf-help/configure-skill-set-add.txt`
- Create: `test/fixtures/cli/malformed/npm-package-version.json`
- Create: `test/fixtures/cli/malformed/cli-version.json`
- Create: `test/fixtures/cli/malformed/help-json.json`

- [ ] **Step 1: 写 fixture 模式失败测试**

命令接口固定为：

```text
inspect-octopus-cli [--fixture-dir <absolute-dir> | --cli-path <absolute-binary>]
                    [--output <absolute-dir>]
```

`--output` 默认当前目录下 `generated/`。断言 `--fixture-dir` 与 `--cli-path` 互斥；fixture 模式绝不调用子进程；输出固定生成：

```text
generated/octopus-cli-version.json
generated/octopus-cli-help.json
generated/cli-command-index.json
```

命令索引只证明路径存在，不推导选项、Payload 或 toolkitKey。
合法 fixture 分别提供 npm 包版本与 CLI 自报版本；原始 help-json 和叶子帮助逐字节保存在输出的 `diagnostics/raw/`，stderr 只进入 `diagnostics/` 且后续不得打包。
`valid`、`missing-command`、`help-conflict` 和 `malformed` 每个目录都是可独立传给 `--fixture-dir` 的完整 fixture，统一使用 `npm-package-version.json`、`cli-version.json`、`help-json.json` 和存在时的 `leaf-help/<operation-slug>.txt`；不得在测试中从另一 fixture 隐式补文件。`malformed/help-json.json` 故意保存非法 JSON 原始字节。

- [ ] **Step 2: 写冲突矩阵失败测试**

覆盖：

- 契约命令存在且叶子帮助相符 → `supported`。
- 契约命令缺失且有人工路径 → `manual-required`。
- 命令缺失且无人工路径 → `blocked/B_CLI_COMMAND_MISSING`。
- CLI 出现未登记写命令 → `WARNING/W_CLI_UNCATALOGED_WRITE`。
- 叶子帮助与契约参数形状冲突 → `BLOCKER/B_CLI_CONTRACT_CONFLICT`。
- npm 包版本与自报版本不同 → 两者分别记录，不报等同。
- `--help` 成功为 `0`；契约内容冲突为 `1`；参数错误为 `2`；CLI 缺失、子进程失败或 malformed help-json 为 `3`。

- [ ] **Step 3: 运行测试并确认红灯**

Run: `npm test -- --run test/unit/assembly/operation-catalog.test.js test/integration/inspect-octopus-cli.test.js`

Expected: FAIL，提示探测模块不存在。

- [ ] **Step 4: 实现探测器**

真实模式只允许执行 npm 包版本探测、CLI 自报版本、`--help-json` 和目录登记叶子命令的 `--help`；`cli-runner.js` 使用参数数组和 `shell: false`，禁止拼接 Shell。探测结果连同原始诊断写 staging 后原子替换输出目录。未找到 CLI 时输出安装指引和 `BLOCKER`，不得调用 npm 安装；注入的 spawn 失败必须退出 `3` 且保留已获得诊断但不提交半成品命令索引。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test -- --run test/unit/assembly test/integration/inspect-octopus-cli.test.js`

Expected: 全部 PASS，fixture 测试的子进程 spy 调用次数为 `0`。

```bash
git add scripts/inspect-octopus-cli src/commands/inspect-octopus-cli.js src/assembly test/unit/assembly test/integration/inspect-octopus-cli.test.js test/fixtures/cli
git commit -m "feat: inspect octopus cli through versioned contracts"
```

### Task 7: 验证装配计划并渲染只读 dry-run Shell

**Files:**

- Create: `scripts/render-dryrun-script`
- Create: `src/commands/render-dryrun-script.js`
- Create: `src/assembly/assembly-validator.js`
- Create: `src/assembly/dryrun-renderer.js`
- Create: `src/assembly/shell-safety.js`
- Create: `src/assembly/dryrun-runner.js`
- Create: `test/unit/assembly/assembly-validator.test.js`
- Create: `test/unit/assembly/dryrun-renderer.test.js`
- Create: `test/integration/render-dryrun-script.test.js`
- Create: `test/integration/validate-project-cli.test.js`
- Create: `test/fixtures/assembly/injection-attempt/operations.yaml`
- Create: `test/fixtures/assembly/renderable-project/assembly/operations.yaml`
- Create: `test/fixtures/assembly/renderable-project/assembly/payloads/example.json`
- Create: `test/fixtures/assembly/renderable-cli/octopus-cli-version.json`
- Create: `test/fixtures/assembly/renderable-cli/octopus-cli-help.json`
- Create: `test/fixtures/assembly/renderable-cli/cli-command-index.json`
- Create: `test/fixtures/assembly/renderable-cli/diagnostics/raw/help-json.json`
- Create: `test/fixtures/assembly/renderable-cli/diagnostics/raw/leaf-help/configure-skill-set-add.txt`
- Modify: `src/commands/validate-project.js`
- Modify: `src/contracts/project-validator.js`
- Modify: `test/integration/validate-project.test.js`

- [ ] **Step 1: 写装配 envelope 与依赖图失败测试**

断言三种 envelope 互斥、supported 写操作恰好一个 Payload、Schema URI 必须登记、依赖必须存在且无环、操作顺序稳定、manual/blocked 不得包含命令字段。

- [ ] **Step 2: 写 Shell 安全失败测试**

覆盖换行、NUL、命令替换、反引号、Shell 元字符、相对越界 Payload、未声明选项和位置参数，全部拒绝。合法输出必须：

- 以 `#!/usr/bin/env bash` 和 `set -euo pipefail` 开头。
- 只有 `run_octopus_dryrun` 可执行 CLI。
- 函数首参数必须为 `--dryrun`，否则退出。
- 每个调用显式把 `--dryrun` 放在函数第一个实参。
- mode 为 `0755`，不存在非 dry-run 写执行行。
- operation ID、Payload 相对路径和命令 path segment 同时满足 `[a-z0-9][a-z0-9._/-]*` 并精确存在于 catalog allowlist。
- 所有业务值只能存在于 Payload JSON，operation 中不得出现可渲染自由文本值。
- 每个 supported 写操作按依赖拓扑恰好映射一次包装调用，manual/blocked 映射零次。
- 脚本启动时对自身生成的 CLI 调用行执行 dry-run 完整性检查，发现一行缺少首参数 `--dryrun` 即在调用 CLI 前退出 `1`。

- [ ] **Step 3: 运行测试并确认红灯**

Run: `npm test -- --run test/unit/assembly test/integration/render-dryrun-script.test.js`

Expected: FAIL，提示装配校验或渲染模块不存在。

- [ ] **Step 4: 实现结构化 argv 渲染器**

输入只接受已通过 Schema 与 catalog allowlist 校验的 operation 对象；先生成 argv 数组，再用单一 POSIX 单引号转义器输出。禁止接受自由文本命令。命令接口：

```text
render-dryrun-script <project-dir> --cli-evidence <generated-dir>
                     [--output <absolute-script>]
```

只在 CLI 证据有效且至少一个 supported 写操作时原子生成脚本，否则删除 staging 并登记 `not-applicable` 或 `blocked`，不得留下空文件。`shell-safety.js` 可从 operations 重新渲染期望字节，现有脚本有任一字节差异或 `bash -n` 失败均返回 `B_DRYRUN_SCRIPT_TAMPERED`。

- [ ] **Step 5: 写 dry-run 运行证据与最终校验失败测试**

`dryrun-runner.js` 仅在用户同时显式提供 `--run-dryrun --profile <name> --team <id>` 时，按同一验证 run 执行全部 supported 写操作；通过临时绝对路径注入的 fake CLI 测试 wrapper 映射：成功 `0`，已识别 usage/unknown-option/invalid-json/schema/payload 错误 `1`，包装器用法错误 `2`，认证/Profile/Team/进程/未知错误 `3`。原始退出码和 stderr 只写诊断。

真实运行必须显式传 `--cli-path <absolute-binary>`，先解析 realpath 和二进制 SHA-256，随后所有操作都用该精确路径、argv 数组和 `shell: false` 执行；禁止 PATH 再解析。`--cli-fixture-dir` 与 `--run-dryrun` 互斥，fixture 只验证离线契约。测试 fake CLI 也通过临时目录中的绝对 `--cli-path` 注入。

artifact-set 精确定义为这些交付路径：`fde-project.yaml`、`discovery/**`、`design/**`、`employees/**`、`skills/**`、`arcubase/**`、`assembly/operations.yaml`、`assembly/payloads/**`、`assembly/octopus-cli-dryrun.sh`、`acceptance/**`、`delivery-summary.md`；排除 `inputs/source-files/**`、`generated/**`、`reports/**`、`delivery/**` 和证据自身。路径按 UTF-8 字节排序；YAML/JSON 使用安全解析后的 RFC 8785 bytes，Markdown 使用 LF/尾空白规范化 bytes，Shell 和其他文件使用原始 bytes。对每个 `path + NUL + file-sha256 + LF` 记录拼接后计算整体 SHA-256。

证据 `reports/cli-dryrun-evidence.json` 固定包含 `run_id`、明确 profile/team、CLI 两种版本、CLI binary realpath/SHA-256、上述 artifact-set SHA-256、开始/结束时间，以及每个 supported operation 恰好一条结果和 argv hash。只有同一 run、同一 artifact hash、同一 CLI 二进制且全成功才允许 `cli-dryrun-validated`；fixture 探测和只渲染脚本最高保持 `delivery-ready`。

先写 `validate-project-cli.test.js`，断言最终 `validate-project` 支持：

```text
validate-project <project-dir>
  [--cli-fixture-dir <dir> | --cli-path <binary>]
  [--run-dryrun --profile <name> --team <id>]
```

它必须消费 CLI 命令/原始叶子帮助证据、校验 Payload、重新渲染并 byte-compare 脚本、运行 `bash -n`，并按上述证据派生状态。tampered 脚本、旧 artifact hash、只成功部分操作都不得升级状态。接口测试还必须拒绝 fixture + run、run 缺 profile/team、或 run 未给绝对 cli-path。

- [ ] **Step 6: 运行新增测试并确认红灯**

Run: `npm test -- --run test/integration/validate-project-cli.test.js`

Expected: FAIL，提示 dryrun runner 或 validate-project CLI 集成尚未实现。

- [ ] **Step 7: 实现运行证据和校验器集成**

实现结构化 argv 的 dry-run runner、错误分类与原子证据写入。修改 `project-validator.js` 和命令层，将 Task 6 的探测、Task 7 的装配/Payload/脚本验证接入完整项目校验；底层环境错误在报告中转成项目 BLOCKER 或 WARNING，并由 `validate-project` 按规范返回 `1` 或 `0`，但探测器直接调用仍返回 `3`。
为两个命令写出并通过完整进程矩阵：`render-dryrun-script` 合法生成 `0`、可读但 operation/Payload/契约非法 `1`、flag/参数/互斥选项错误 `2`、项目/证据路径不可读或原子写失败 `3`；集成后的 `validate-project` 合法项目 `0`、项目 BLOCKER `1`、调用错误 `2`、不能纳入项目报告的文件系统/运行时失败 `3`。

- [ ] **Step 8: 运行双层安全验证**

Run: `npm test -- --run test/unit/assembly test/integration/render-dryrun-script.test.js`

Expected: 全部 PASS。

Run: `./scripts/render-dryrun-script test/fixtures/assembly/renderable-project --cli-evidence test/fixtures/assembly/renderable-cli --output test-output/octopus-cli-dryrun.sh`

Expected: exit `0`；renderer 自动原子创建此前不存在的 `test-output/` 父目录，并生成 mode `0755` 的脚本。对应集成测试必须先从不存在的父目录开始验证这一行为。

Run: `bash -n test-output/octopus-cli-dryrun.sh`

Expected: exit `0`。

- [ ] **Step 9: 验证 Chunk 2 并提交**

Run: `npm run verify`

Expected: 所有测试 PASS，仓库检查无问题。

```bash
git add scripts/render-dryrun-script src/commands/render-dryrun-script.js src/commands/validate-project.js src/contracts/project-validator.js src/assembly/assembly-validator.js src/assembly/dryrun-renderer.js src/assembly/shell-safety.js src/assembly/dryrun-runner.js test/unit/assembly test/integration/render-dryrun-script.test.js test/integration/validate-project.test.js test/integration/validate-project-cli.test.js test/fixtures/assembly
git commit -m "feat: render mutation-safe octopus dryrun scripts"
```

## Chunk 3: 金标准、离线打包、安装与 CI

### Task 8: 签入并验证“线索收集数字员工”金标准

**Files:**

- Create: `scripts/test-example`
- Create: `src/commands/test-example.js`
- Create: `src/project/golden-comparator.js`
- Create: `assets/examples/lead-collector/input/requirements.txt`
- Create: `assets/examples/lead-collector/expected-artifacts.yaml`
- Create: `assets/examples/lead-collector/cli-fixture/npm-package-version.json`
- Create: `assets/examples/lead-collector/cli-fixture/cli-version.json`
- Create: `assets/examples/lead-collector/cli-fixture/help-json.json`
- Create: `assets/examples/lead-collector/cli-fixture/leaf-help/configure-skill-set-add.txt`
- Create: `assets/examples/lead-collector/cli-fixture/leaf-help/configure-team-private-digiworkers-add.txt`
- Create: `assets/examples/lead-collector/cli-fixture/leaf-help/configure-employee-hire.txt`
- Create: `assets/examples/lead-collector/expected-project/**`
- Create: `test/unit/project/golden-comparator.test.js`
- Create: `test/integration/test-example.test.js`

- [ ] **Step 1: 写 Golden 比较器和命令失败测试**

用微型夹具精确断言：

- 路径 `/` 化后按 UTF-8 字节排序。
- 文件缺失或多出均失败。
- YAML/JSON 按安全解析 + RFC 8785 哈希。
- Markdown 只做 LF/尾空白规范化，并检查有序 `required_literals` 与 `forbidden_literals`。
- Shell 同时检查 SHA-256、`0755` 和 dry-run 安全字面量。
- 常规测试没有更新期望值的代码路径。

`test-example.test.js` 在生产代码和完整 fixture 尚不存在时先断言命令接口、fixture-only CLI、临时目录清理、23 文件精确集合和零 BLOCKER。命令退出矩阵固定为：匹配成功 `0`；可读但 Golden/项目契约不匹配 `1`；未知 example、flag 或缺参数 `2`；fixture/临时目录不可读写或未分类运行时失败 `3`。

- [ ] **Step 2: 运行比较器测试并确认红灯**

Run: `npm test -- --run test/unit/project/golden-comparator.test.js test/integration/test-example.test.js`

Expected: FAIL，提示比较器或 `test-example` 命令不存在。

- [ ] **Step 3: 实现比较器和示例命令**

`test-example --example lead-collector` 复制已签入 `expected-project/` 到临时目录，使用 `--fixture-dir` 探测、重新渲染 dry-run、运行项目校验，再比较期望清单；完成后删除临时目录。它不得调用 LLM、网络或全局 CLI。本任务先完成项目、Schema、装配和目录边界验证；Task 9 在 delivery 模块可用后必须修改同一命令并加入真实临时打包边界验证。

- [ ] **Step 4: 创建精确的 23 文件金标准**

按规范固定的小采员工、`collect-sales-leads` Skill、九字段 Arcubase 表、角色权限、九个验收用例和一个 supported live-gated 操作编写 `expected-project/`。`expected-artifacts.yaml` 逐项列出 23 个路径；普通 Skill 上传、Skill-set 创建和绑定、Arcubase App 和表创建只出现在人工操作中，不生成 Payload。

- [ ] **Step 5: 运行示例并确认确定性**

Run: `./scripts/test-example --example lead-collector`

Expected: exit `0`、零 `BLOCKER`、报告显示 `23/23` 文件匹配。

Run: `./scripts/test-example --example lead-collector && ./scripts/test-example --example lead-collector`

Expected: 两次摘要和所有比较哈希一致。

- [ ] **Step 6: 提交**

```bash
git add scripts/test-example src/commands/test-example.js src/project/golden-comparator.js assets/examples/lead-collector test/unit/project/golden-comparator.test.js test/integration/test-example.test.js
git commit -m "test: add deterministic lead collector golden project"
```

### Task 9: 实现敏感扫描、包清单与事务化离线 ZIP

**Files:**

- Create: `scripts/package-delivery`
- Create: `src/commands/package-delivery.js`
- Create: `src/delivery/file-selection.js`
- Create: `src/delivery/sensitive-scan.js`
- Create: `src/delivery/package-manifest.js`
- Create: `src/delivery/zip-writer.js`
- Create: `test/unit/delivery/file-selection.test.js`
- Create: `test/unit/delivery/sensitive-scan.test.js`
- Create: `test/unit/delivery/package-manifest.test.js`
- Create: `test/integration/package-delivery.test.js`
- Create: `test/fixtures/package-policy/project/reports/package-scan-policy.yaml`
- Modify: `src/commands/test-example.js`
- Modify: `test/integration/test-example.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 写文件边界和扫描失败测试**

断言默认排除源文件、备份、临时文件、凭据、`.env`、generated、旧 ZIP、原始 stderr 和任何原始绝对来源路径。测试运行时在临时目录生成 secret/.env 夹具，不把假密钥签入仓库。密钥/Token/Cookie/Profile/内部服务地址不可豁免；本项目客户名为 INFO；个人数据必须逐文件逐类别确认；其他租户标识为 BLOCKER；宽泛正则豁免无效。此步骤同时先扩展 `test-example.test.js`，要求命令调用尚未实现的临时打包检查并比较 ZIP 文件边界。

若入包的 `fde-project.yaml` 含 `sources[].original_path`，staging 副本必须替换为稳定 `redacted://source/<index>` 并在扫描报告记录；不得修改客户工作目录原文件。其他交付文件出现绝对来源路径时为 `BLOCKER`。

- [ ] **Step 2: 写包清单失败测试**

清单记录除自身外每个文件的相对路径、SHA-256、分类和 `self_entry: excluded`。验证路径顺序、重复路径、大小写冲突、符号链接、越界路径和清单哈希不一致均失败。
ZIP 条目必须按 UTF-8 相对路径字节序排列，不写目录条目，mtime 固定为 ZIP epoch `1980-01-01T00:00:00Z`，普通文件 mode `0644`、唯一 dry-run Shell `0755`，压缩设置固定且不写宿主路径/uid/gid/平台 extra metadata。同一 staging 字节与同一注入时钟必须生成 byte-for-byte 相同 ZIP。

- [ ] **Step 3: 运行测试并确认红灯**

Run: `npm test -- --run test/unit/delivery test/integration/package-delivery.test.js test/integration/test-example.test.js`

Expected: FAIL，提示 delivery 模块不存在，且 `test-example` 的临时打包断言尚未满足。

- [ ] **Step 4: 实现扫描与事务打包**

命令接口：

```text
package-delivery <project-dir> [--include-sources]
                 [--confirm-personal-data] [--output <absolute-zip>]
```

先要求前六阶段完整且项目校验零 BLOCKER，再在同级 staging 组包。若存在 supported 写操作，打包前独立调用 `shell-safety.js` 从 operations 重渲染并逐字节比较 dry-run Shell，再运行 `bash -n`；不得只信旧验证报告。若 supported 写操作为零，必须验证 dry-run Shell 不存在且产物矩阵明确为 `not-applicable`，这一合法分支仍可达到 `delivery-ready`。

staging 中先应用脱敏投影，然后复用 Task 5 的权威 `acceptStage` 逻辑收口 `validate`：从 `catalog/stage-artifacts.yaml` 读取完整输入/输出集，记录全部哈希并只在本次基线变化时把 `baseline_revision` 精确加一；重复打包未变化项目时 revision 保持不变。禁止直接赋值 `status: complete`。

打包专用 `package_input_hash` 使用 Task 7 的 artifact-set 路径、排序和每类文件 canonical 规则，但对 `fde-project.yaml` 先移除纯派生字段 `project.status` 与整个 `stage_status.validate`；保留客户事实、`project.delivery_approved_at` 和前六阶段状态。它明确排除 `reports/**`、包清单和 ZIP，因此打包自身不能改变输入键。`reports/package-validation.json` 以 `package_input_hash + scan_policy_hash + kit_commit` 为幂等键，内容固定含这三项、首次成功的 `validated_at` 和验证结果；键未变时逐字节复用旧报告。每次包内 `package-manifest.json` 另记 `packaged_at`，但 manifest 不进入阶段 output hash，报告也不含 `packaged_at`。

生成最终 `fde-project.yaml`、包清单并反向验证，再创建临时 ZIP、重新读取 ZIP 校验路径与哈希。`validate` 的阶段输出只记录验证报告和打包证据，不把包清单自身哈希写回 `fde-project.yaml`，避免自引用。全部成功后，以一个事务原子提交客户目录中的新 `fde-project.yaml`、`reports/package-validation.json` 和目标 ZIP；任一步失败恢复三者旧值。测试必须覆盖首轮 revision、不同实际时钟下的幂等二次打包、任一权威产物变化后的单次递增，以及下游不存在时无额外状态修改。

默认从注入时钟记录 manifest 的 `packaged_at`；测试使用固定 `SOURCE_DATE_EPOCH=1784854800`，相同输入和时钟两次 ZIP 必须逐字节相同。`--include-sources` 未同时明确确认风险时退出 `2`。目标 ZIP 已存在时默认退出 `1` 且不得覆盖；V1 不提供覆盖 flag，用户必须选择新路径或移走旧包。加入依赖 `yazl: ^3.3.1` 并更新 lockfile。
命令测试逐项断言：合法打包 `0`；扫描、manifest、Shell 安全、已有输出或项目契约失败 `1`；非法 flag、相对 output、缺确认或无效 `SOURCE_DATE_EPOCH` 为 `2`；源目录不可读、ZIP/原子事务或未分类运行时失败 `3`；`--help` 为 `0` 且零写入。
所有成功与失败路径都在 `finally` 清除 staging 目录、临时 manifest 和临时 ZIP；故障注入测试逐个覆盖扫描、渲染、ZIP 写入、反向校验和三输出提交位置，并断言既恢复旧输出，也不存在含脱敏投影内容的 `.tmp-*`、staging 或临时 archive 残留。

- [ ] **Step 5: 验证打包结果**

Run: `npm test -- --run test/unit/delivery test/integration/package-delivery.test.js`

Expected: 全部 PASS；恶意夹具无 ZIP 残留；合法 ZIP 不含默认排除项。

Run: `SOURCE_DATE_EPOCH=1784854800 npm test -- --run test/integration/package-delivery.test.js test/integration/test-example.test.js`

Expected: 两次打包 bytes 相同；`test-example` 同时验证 ZIP 文件集与默认隐私边界。

Run:

```bash
AIWORKER_PACKAGE_TMP=$(mktemp -d)
cp -R assets/examples/lead-collector/expected-project "$AIWORKER_PACKAGE_TMP/project"
./scripts/package-delivery "$AIWORKER_PACKAGE_TMP/project" --output "$AIWORKER_PACKAGE_TMP/aiworker-fde-lead-collector.zip"
```

Expected: exit `0`，ZIP 内 manifest 自校验通过，项目状态最高为 `delivery-ready`，不声称正式平台验收。

- [ ] **Step 6: 提交**

```bash
git add scripts/package-delivery src/commands/package-delivery.js src/commands/test-example.js src/delivery test/unit/delivery test/integration/package-delivery.test.js test/integration/test-example.test.js test/fixtures/package-policy package.json package-lock.json
git commit -m "feat: package sanitized offline delivery archives"
```

### Task 10: 实现 Codex/Claude Code 事务安装器

**Files:**

- Create: `scripts/install`
- Create: `src/commands/install.js`
- Create: `src/install/file-snapshot.js`
- Create: `src/install/preflight.js`
- Create: `src/install/transaction.js`
- Create: `src/install/discovery-check.js`
- Create: `test/unit/install/file-snapshot.test.js`
- Create: `test/unit/install/preflight.test.js`
- Create: `test/integration/install.test.js`

- [ ] **Step 1: 写文件快照失败测试**

断言跟踪集只含规范列出的 Skill 文件，排除 `.git/**` 与 `docs/**`；普通文件、符号链接、mode、link target 和 SHA-256 按精确定义进入树哈希；新增、删除、改名、类型和权限变化都能检测。

- [ ] **Step 2: 写预检真值表失败测试**

覆盖目标/清单的五种组合、`--update` 与 `--replace` 互斥、copy 更新用户修改、symlink 幂等/失效/指向其他源、源路径变化、孤儿清单以及 `both` 任一目标冲突。
逐项断言命令边界：成功/幂等 `0`；目标或清单冲突、用户修改 `1`；非法 target/mode、互斥 flag 或缺参数 `2`；复制、权限、原子提交或未分类运行时故障 `3`；`--help` 为 `0` 且零写入。

- [ ] **Step 3: 写事务回滚失败测试**

向准备、目标提交、清单提交和发现检查四个位置注入失败；每次都断言旧目标和旧清单逐字节恢复，另一个 target 不留下半提交，mode 保留。

- [ ] **Step 4: 运行测试并确认红灯**

Run: `npm test -- --run test/unit/install test/integration/install.test.js`

Expected: FAIL，提示安装模块不存在。

- [ ] **Step 5: 实现安装器**

接口严格为：

```text
install --target codex|claude-code|both --mode symlink|copy
        [--update] [--replace]
```

默认 mode 为 symlink，默认目标分别为 `${HOME}/.agents/skills/design-aiworker-solutions` 与 `${HOME}/.claude/skills/design-aiworker-solutions`，清单使用 `${XDG_CONFIG_HOME:-$HOME/.config}`。测试通过显式临时 HOME/XDG 注入，绝不碰开发机真实安装目录。安装器不执行 `git pull`。

- [ ] **Step 6: 运行两种布局验证**

Run: `npm test -- --run test/unit/install test/integration/install.test.js`

Expected: symlink/copy、Codex/Claude/both、幂等、更新、替换和回滚测试全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add scripts/install src/commands/install.js src/install test/unit/install test/integration/install.test.js
git commit -m "feat: install skill transactionally for codex and claude"
```

### Task 11: 完成 CI、端到端验证与发布文档

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `docs/installation.md`
- Create: `docs/fde-operator-guide.md`
- Create: `docs/maintenance.md`
- Create: `docs/agent-forward-test.md`
- Create: `evals/forward-test-cases.yaml`
- Create: `evals/results/v0.1.0-baseline.md`
- Create: `evals/results/v0.1.0-with-skill.md`
- Create: `scripts/validate-forward-test`
- Create: `src/commands/validate-forward-test.js`
- Create: `scripts/scan-public-repository`
- Create: `src/security/public-scan.js`
- Create: `catalog/public-content-allowlist.yaml`
- Create: `test/integration/public-scan.test.js`
- Create: `test/integration/forward-test-report.test.js`
- Create: `test/integration/end-to-end.test.js`
- Create: `test/integration/repository-release-contract.test.js`
- Modify: `package.json`
- Modify: `SKILL.md`

- [ ] **Step 1: 写端到端失败测试**

在 `end-to-end.test.js` 的隔离临时目录串联：

1. `init-project` 先预览后确认创建。
2. 用金标准内容填充项目。
3. fixture CLI 探测。
4. 装配计划、Payload、dry-run 脚本校验。
5. 只接受前六阶段。
6. 调用 `package-delivery` 的最终事务完成扫描、manifest 复验并收口 `validate` 阶段。
7. copy 模式分别安装至伪 Codex/Claude HOME。

断言全流程无网络、无真实 CLI、无生产写操作、ZIP 可复现且最终为 `delivery-ready`。若使用 fixture 探测，不得出现 `cli-dryrun-validated`。

同时先写 `repository-release-contract.test.js`，断言尚未创建的两个 npm verify scripts、`SKILL.md` 交付边界/文档链接、三份操作文档以及 CI 的 offline/compatibility 两个 job；这组断言提供本任务确定的初始红灯。

- [ ] **Step 2: 运行测试并确认红灯**

Run: `npm test -- --run test/integration/end-to-end.test.js test/integration/repository-release-contract.test.js`

Expected: `repository-release-contract.test.js` FAIL，因为 `verify:e2e`、文档与 CI 契约尚未加入；端到端行为若已由前序任务满足可以 PASS。

- [ ] **Step 3: 完成 package、Skill 和端到端命令契约**

在 `package.json` 加入：

```json
{
  "scripts": {
    "verify:e2e": "vitest run test/integration/end-to-end.test.js",
    "verify:public": "./scripts/scan-public-repository"
  }
}
```

现有 `verify` 的 `test:run` 已包含 end-to-end，因此不重复串联 `verify:e2e`；CI 单独调用它以清晰展示端到端门。修改 `SKILL.md` 的交付阶段，精确列出 `validate-project`、`package-delivery`、状态含义与“停在离线交付包”的边界，并链接安装/操作文档。重新运行并确认 Task 8–10 已拥有的 `package-delivery`、`test-example` 和 `install` 的 `--help`、`0/1/2/3` 边界断言，不在本任务改写其测试；public scanner 与 forward-test validator 的边界分别留在 Step 4 和 Step 6 的先红后绿测试中。

- [ ] **Step 4: 以 TDD 实现公开仓库扫描门**

先写 `public-scan.test.js`：在临时 git 仓库动态生成每类恶意内容并断言 `1`，调用错误 `2`、不可读/runtime `3`、清洁仓库 `0`。

Run: `npm test -- --run test/integration/public-scan.test.js`

Expected: FAIL，提示 public scanner 尚未实现。

再实现：`public-content-allowlist.yaml` 只允许金标准中的虚构公司/人员/电话、固定 localhost 测试值和测试错误词，不允许密钥形态。`public-scan.js` 使用 `git ls-files --cached --others --exclude-standard` 扫描全部 tracked 及非忽略 untracked 路径、文件名和内容，因而提交前新文件也在范围内；阻断 `.env`、私钥、常见 access/refresh/bearer token、cookie、认证 Profile、绝对用户路径、内部域名/IP、allowlist 外的示例公司/人员/联系方式和二进制未知文件。

Run: `npm test -- --run test/integration/public-scan.test.js`

Expected: PASS。

- [ ] **Step 5: 编写 CI**

`ci.yml` 使用 Node 20，普通 `offline` job 执行 `npm ci`、`npm run verify`、`npm run verify:public`、`./scripts/test-example --example lead-collector` 和 `npm run verify:e2e`，不访问 secrets。

独立 `octopus-cli-compatibility` job 只在每周 schedule 和 `workflow_dispatch` 运行：执行 `npm install --global @syngy/octopus-cli@0.1.1`、`octopus-cli --version`、`octopus-cli --help-json`，解析 `command -v octopus-cli` 为绝对路径，再运行 `./scripts/inspect-octopus-cli --cli-path "$AIWORKER_CLI_PATH" --output test-output/compat-cli`。不传 Profile、Team 或 `--run-dryrun`。总是上传 `test-output/compat-cli`；契约不匹配时 job 失败并保留版本、原始 help-json、叶子帮助和命令索引。

- [ ] **Step 6: 以 TDD 编写 Agent forward-test 校验器及文档**

`installation.md` 给出 Codex/Claude 的 symlink/copy、更新、冲突和卸载说明；`fde-operator-guide.md` 说明名称确认、七阶段、四闸门、离线交付与 `octopus-cli` dry-run；`maintenance.md` 说明 toolkit/operation 契约更新、Golden 显式维护、语义化 tag 和 Release。文档不得承诺自动正式装配。

先写 `forward-test-report.test.js`，用临时报告断言六类用例、baseline/with-skill 双轨、所需元数据、脱敏规则和 with-skill 校验结果；不完整报告为 `1`、调用错误 `2`、路径/运行时错误 `3`、完整报告 `0`。

Run: `npm test -- --run test/integration/forward-test-report.test.js`

Expected: FAIL，提示 `validate-forward-test` 尚未实现。

再实现并编写文档：`forward-test-cases.yaml` 将 Agent 行为评估与确定性 CI 分离，固定六类用例：最小线索收集、资料冲突、CLI 缺失、无目标 Team、External Station、半成品 resume。`agent-forward-test.md` 要求两组隔离的新 Agent 会话：baseline 不安装/不读取本 Skill，with-skill 通过安装器发现本 Skill；每组记录输入、Kit commit、Agent/模型、时间、产物目录、问题清单和校验输出。`validate-forward-test` 只验证结果目录经过安全扫描、文件集/Schema/交叉检查/行为用例，不对 prose 做哈希，也不调用模型。

- [ ] **Step 7: 执行并记录独立 Agent forward-test**

按 `@superpowers:subagent-driven-development` 使用全新 Agent 分别跑 baseline 和 with-skill；每个 Agent 只获得 `forward-test-cases.yaml` 中的输入及对应隔离目录。将脱敏摘要写入两份结果文档：baseline 记录缺失交付物/错误选型/一致性问题，with-skill 记录同一输入的改善与仍存问题；不得签入原始对话、凭据或机器绝对路径。

Run: `./scripts/validate-forward-test evals/results`

Expected: exit `0`；报告确认六类用例均有 baseline/with-skill 记录，with-skill 产物全部通过统一不变量，两个轨道未进行 prose/hash 逐字比较。

- [ ] **Step 8: 完成全量验证**

Run: `npm run verify`

Expected: 全部 unit/integration 测试 PASS，仓库检查零问题。

Run: `./scripts/test-example --example lead-collector`

Expected: `23/23` 文件匹配、零 BLOCKER。

Run: `npm test -- --run test/integration/end-to-end.test.js`

Expected: PASS，输出包含 `delivery-ready`。

Run: `npm run verify:public`

Expected: exit `0`，所有 tracked 文件通过密钥、Token、Cookie、Profile、`.env`、内部地址、绝对路径和示例身份 allowlist 检查。

Run: `./scripts/validate-forward-test evals/results`

Expected: exit `0`，六类 baseline/with-skill 发布证据仍完整且已脱敏。

- [ ] **Step 9: 使用完成前验证 Skill**

使用 `@superpowers:verification-before-completion` 重新运行本任务 Step 8 的全部命令，检查 `git status --short` 只含本任务预期文件，并记录真实输出；不得根据旧测试结果宣称完成。

- [ ] **Step 10: 提交**

```bash
git add .github/workflows/ci.yml docs/installation.md docs/fde-operator-guide.md docs/maintenance.md docs/agent-forward-test.md evals scripts/validate-forward-test scripts/scan-public-repository src/commands/validate-forward-test.js src/security/public-scan.js catalog/public-content-allowlist.yaml test/integration/public-scan.test.js test/integration/forward-test-report.test.js test/integration/end-to-end.test.js test/integration/repository-release-contract.test.js package.json SKILL.md
git commit -m "ci: verify complete offline fde delivery workflow"
```

## 最终验收与发布检查

- [ ] 使用 `@superpowers:requesting-code-review` 对完整实现执行需求一致性与代码质量两阶段审查。
- [ ] 修复审查中的所有阻断问题并重跑 `npm run verify`、Golden 和端到端测试。
- [ ] 确认 `git status --short` 干净，脚本 mode 为 `0755`，仓库不含真实客户/租户/密钥。
- [ ] 确认公开仓库默认分支 `main` 通过 CI 后，再创建语义化 tag `v0.1.0` 和对应 GitHub Release。
- [ ] Release 说明明确 V1 只交付“完整离线包 + 校验 + 可选 CLI dry-run”，不执行正式平台装配。
