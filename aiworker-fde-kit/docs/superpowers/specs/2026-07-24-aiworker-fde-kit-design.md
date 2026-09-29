# AIWorker FDE Kit 设计规范

日期：2026-07-24  
状态：已完成五轮独立规范审查及问题修订，并于 2026-07-24 获得用户书面确认
目标仓库：`syngy-ai/aiworker-fde-kit`（公开）  
许可证：Apache-2.0

## 1. 背景与目标

AIWorker 数字员工平台已经形成一套五阶段 FDE 方法：需求与场景建模、数字员工团队设计、数据地基设计、员工 Skill 编写、装配与发放。现有方法主要以 AIWorker 平台内部的多个 `fde-*` Skill 和设计文档存在，不适合 FDE 工程师在 Codex 或 Claude Code 中，以本地工程项目的方式持续维护一套客户交付物。

本项目建设一个公开、可安装、可版本管理的 FDE 工程 Skill。它帮助 FDE 工程师把客户需求和资料转化为完整、相互一致、可校验的 AIWorker 数字员工或数字员工团队离线交付包。

第一版的完成边界是：

- 支持从简短需求、客户资料集或已有半成品项目进入。
- 生成数字员工团队、员工定义、员工 Skill、Arcubase、权限、装配和验收等交付物。
- 使用本机 `octopus-cli` 的机器可读帮助校验装配命令与 Payload。
- 可在具备有效登录和目标 Team 时执行 `octopus-cli --dryrun`。
- 不执行正式发布、建表、创建员工、雇佣员工或其他生产写操作。

本规范中的“离线”表示项目生成、Schema 校验、引用检查和交付打包不依赖网络或目标 Team。只有用户显式要求时，才允许执行目标 Team 的只读能力查询或使用本地 Profile 的 `octopus-cli --dryrun`；两者都不授权正式写操作。如果未来 CLI 的 dry-run 实现会访问网络，工具必须在执行前披露并再次取得用户确认。

## 2. 非目标

第一版不承担：

- 自动登录 AIWorker 平台或管理认证凭据。
- 对生产或客户 Team 执行正式装配。
- 替客户决定未确认的业务事实、权限边界或高风险动作。
- 把全部平台文档原样复制到 Skill 上下文。
- 同时维护两套分别面向 Codex 和 Claude Code 的核心方法论。
- 覆盖所有行业的预制数字员工模板。
- 将现有“云图 AI 数字员工设计项目”作为验收金标准。

## 3. 用户与核心使用场景

主要用户是 AIWorker 平台的 FDE 工程师、交付架构师和方案实施人员。

### 3.1 新建项目

用户提供一句需求、访谈记录或初步场景。Skill 建议项目名称和目录，用户确认后初始化项目并逐步完成交付。

### 3.2 资料驱动

用户提供 Word、Excel、PDF、图片、流程说明或已有系统资料。Skill 建立资料索引，区分事实、假设、冲突和待确认事项，再开始设计。

### 3.3 接续已有项目

用户指定一个已有 FDE 项目。Skill 检查目录、清单和阶段状态，识别有效、缺失和过期产物，从最近的有效阶段继续，不默认推倒重来。

### 3.4 入口模式契约

`entry_mode` 只能是：

- `new`：以对话中的需求为首个来源。
- `materials`：以用户指定的一组文件为来源。
- `resume`：以已有、可解析的 `fde-project.yaml` 为入口。

来源文件默认复制到项目私有的 `inputs/source-files/`，同时记录原始路径、SHA-256、媒体类型、读取状态和复制时间。用户可选择只记录路径；此时项目清单必须标记为不可移植。

`resume` 的处理规则：

- 清单合法且 `schema_version` 受支持：读取阶段状态和内容哈希后继续。
- 目录存在但没有清单：进入 `import-proposal`，只生成拟导入清单供用户确认，不直接改写原文件。
- 清单无法解析：报 `BLOCKER`，不写任何下游文件。
- 清单版本过旧：先生成备份和迁移预览；用户确认后才迁移。
- 已有文件内容哈希与清单不一致：视为用户修改，保留原文件并把受影响阶段标为 `needs-review`。

方案基线后的上游变更按依赖图使下游阶段失效。例如业务对象变化会使数据地基、员工 Skill、装配和验收进入 `stale`；校验器不得自动覆盖用户修改的下游文件。

## 4. 总体架构

采用“一个主控 Skill + 按需参考库 + 模板 + Schema + 校验器”的结构。

```text
aiworker-fde-kit/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── fde-methodology.md
│   ├── platform-capabilities.md
│   ├── worker-model.md
│   ├── skill-authoring.md
│   ├── arcubase-design.md
│   ├── identity-and-access.md
│   ├── octopus-cli.md
│   ├── acceptance.md
│   └── conditional-topics/
│       ├── taskboard.md
│       ├── browser-and-webskill.md
│       ├── ontos.md
│       ├── a2ui.md
│       ├── external-station.md
│       └── private-service.md
├── catalog/
│   ├── toolkit-keys.yaml
│   └── assembly-operations.yaml
├── assets/
│   ├── project-template/
│   └── examples/
│       └── lead-collector/
│           ├── input/
│           ├── expected-project/
│           ├── expected-artifacts.yaml
│           └── cli-fixture/
├── schemas/
│   ├── project.schema.json
│   ├── worker.schema.json
│   ├── arcubase.schema.json
│   ├── assembly.schema.json
│   ├── assembly-operation.schema.json
│   └── payloads/
│       └── <operation-id>.schema.json
├── scripts/
│   ├── init-project
│   ├── validate-project
│   ├── inspect-octopus-cli
│   ├── render-dryrun-script
│   ├── test-example
│   ├── package-delivery
│   └── install
└── LICENSE
```

### 4.1 主控 Skill

`SKILL.md` 只承载：

- 使用触发条件。
- 七阶段工作流。
- 四道人审闸门。
- 每个阶段应加载哪些参考。
- 每个阶段的输入和输出契约。
- 禁止越过的安全边界。

详细平台能力、Arcubase 规则、模板和命令不重复写入主文件。

### 4.2 参考库

参考库按主题单层组织，供主控 Skill 在需要时加载。每份参考包含更新时间、适用版本、公开来源或脱敏来源说明。超过 100 行的参考在顶部提供目录。

### 4.3 模板与 Schema

`assets/project-template` 提供客户项目骨架和可读文档模板。`schemas` 定义机器可校验的核心文件形状。模板面向人阅读，Schema 面向脚本验证，两者不重复维护业务事实。

装配契约的职责固定为：

- `assembly.schema.json`：验证整个装配计划、操作顺序、依赖和 Payload 文件引用。
- `assembly-operation.schema.json`：使用 `oneOf` 验证下述三种操作 envelope。
- `schemas/payloads/<operation-id>.schema.json`：验证某项操作的业务 Payload。
- `catalog/assembly-operations.yaml`：把稳定 `operation_id` 映射到 CLI 命令路径、位置参数、选项、Payload Schema URI、契约版本、风险等级和人工降级路径。

三种 envelope 为：

- `supported`：`executor: octopus-cli`；必须有 `command_path`。写操作必须有且只能有一个 `payload_file` 和一个 `payload_schema_uri`；无 Body 的只读操作显式写 `payload_file: null`、`payload_schema_uri: null`。
- `manual-required`：`executor: admin-manual`；必须有非空 `manual_artifacts` 和 `manual_instructions`；禁止出现 `command_path`、`payload_file` 和 `payload_schema_uri`。
- `blocked`：`executor: unavailable`；必须有 `blocker_code` 和 `blocker_reason`；禁止出现命令、Payload 和人工执行字段。

`supported` 操作不存在目录映射、Payload Schema 或版本不匹配时为 `BLOCKER`。人工与阻断操作不伪造 CLI/Payload 契约。

### 4.4 校验器

脚本使用 Node.js 20+，负责初始化、结构验证、交叉引用检查、CLI 能力探测和离线打包。校验器不得执行正式平台写操作。

### 4.5 安装适配

Codex 和 Claude Code 共用根目录的 `SKILL.md`、参考、模板、Schema 和脚本。Codex 使用 `agents/openai.yaml` 展示元数据；Claude Code 直接发现安装目录中的根 `SKILL.md`。安装脚本只处理目标目录、符号链接或复制模式，不生成第二份方法论。

## 5. 客户项目初始化

创建项目前，Skill 根据客户名和核心场景建议：

- 中文项目展示名，例如“星河科技客户线索收集数字员工”。
- ASCII 目录名，例如 `xinghe-lead-collector-fde`。
- 绝对目标路径。
- 入口模式：新建、资料驱动或接续已有项目。

用户确认后才创建目录和 `fde-project.yaml`。目录名使用小写英文、数字和连字符，以兼容 Shell、压缩包和 CLI。

如果目录已经存在，Skill 不覆盖，必须让用户选择：

- 接续现有项目。
- 使用新的目录名。
- 取消创建。

项目清单至少记录：

```yaml
schema_version: 1
project:
  name: 星河科技客户线索收集数字员工
  slug: xinghe-lead-collector-fde
  customer_name: 星河科技
  primary_scenario: 客户线索收集
  entry_mode: new
```

初始化脚本先在同级临时目录生成并校验完整骨架，再以原子重命名完成创建。中途失败时删除临时目录，不留下半个项目。对已有项目的任何迁移或批量更新，先在 `reports/backups/` 保存清单和将被修改文件的备份。

## 6. 七阶段 FDE 工作流

### 6.1 项目初始化

确认项目名称、目录、入口模式和交付边界，创建项目骨架与清单。

### 6.2 资料盘点与需求建模

读取用户指定的资料，生成资料索引、事实、假设、冲突、待确认问题、业务对象、角色、工作流和人在环路点。未经证据支持的内容必须标为假设。

### 6.3 场景与团队设计

用最少数量的数字员工覆盖确认后的工作流。每个员工保持单一、连贯职责。团队设计明确服务对象、职责边界、接力关系、Skill、平台能力、Station 可达性和身份护栏。

### 6.4 平台能力与数据地基设计

选择当前能力目录中真实存在的 toolkitKey。判断采用轻量记忆、专属 Arcubase 应用、只配不改的已有应用或经明确确认后扩展已有应用。

涉及 Arcubase 时，设计 App、Table、Field、Link、状态机、派生字段回写、执行身份、硬权限和对话层过滤。

### 6.5 员工与 Skill 工程化

生成每个员工的完整定义、promptSpec、快捷入口、toolkitKeys 和独立 Skill 包。员工 Skill 必须自包含，不得把客户项目目录中的设计文档作为运行时依赖。

### 6.6 离线装配与验收设计

依据版本化装配契约和当前 `octopus-cli --help-json` 生成装配计划、Payload 和**仅含 `--dryrun` 的预演脚本**。不生成可直接执行生产写操作的 Shell 脚本。

每个装配操作必须声明：

- `executor: octopus-cli | admin-manual | unavailable`
- `support: supported | manual-required | blocked`
- 通用字段：`operation_id`、说明、风险、`depends_on`。
- `supported` 操作声明命令路径、Payload 文件、当前 CLI 是否存在该命令和 Payload Schema 版本。
- `manual-required` 操作声明交付给管理员的文件与步骤。
- `blocked` 操作声明阻断原因与恢复条件。

当前 CLI 没有暴露普通 Skill 包上传或 Arcubase App/Table/Field 创建时，这些步骤标记为 `admin-manual/manual-required`，交付对应 Skill 包、Schema 和人工装配说明；不得伪造 CLI 命令。必要能力既无 CLI 路径也无已确认人工路径时才是 `BLOCKER`。

同步生成正常、异常、权限、拒绝和人在环路验收案例。

### 6.7 总体验证与打包

执行结构、Schema、引用、跨文档一致性、CLI 参数和可选目标环境 dry-run 校验。零阻断项后才能形成交付包。

## 7. 四道人审闸门

### 7.1 项目创建确认

用户确认项目展示名、目录名、绝对路径和入口模式后才写文件。

### 7.2 需求基线确认

进入最终团队设计前，向用户呈现已确认事实、假设、资料冲突、阻断问题和明确不做范围。每次只追问一个最影响设计的问题。用户可授权以标注假设继续形成评审稿。

### 7.3 方案基线确认

展开员工 Skill 和装配文件前，确认员工数量与职责、工作流、数据地基、能力选型、身份权限、人在环路和条件专题。后续变更必须列出受影响的员工、Skill、表、权限和测试。

### 7.4 交付就绪确认

交付前展示问题等级、Kit 与 CLI 版本、校验范围、目标环境 dry-run 状态、人工步骤、文件清单和验证摘要。第一版到此停止，不执行正式装配。

## 8. 标准交付目录

```text
<customer-project>/
├── fde-project.yaml
├── inputs/
│   ├── source-files/
│   └── input-inventory.md
├── discovery/
│   ├── facts-and-assumptions.md
│   ├── open-questions.md
│   └── scenario-model.md
├── design/
│   ├── team-design.md
│   ├── collaboration-and-dataflow.md
│   ├── platform-capability-selection.md
│   ├── data-foundation.md
│   └── identity-and-access.md
├── employees/
│   └── <employee-slug>.md
├── skills/
│   └── <skill-slug>/
│       ├── SKILL.md
│       └── references/
├── arcubase/
│   ├── decision.yaml
│   ├── schema.yaml
│   └── access-matrix.md
├── assembly/
│   ├── assembly-plan.md
│   ├── operations.yaml
│   ├── octopus-cli-dryrun.sh
│   └── payloads/
├── acceptance/
│   ├── acceptance-plan.md
│   └── test-cases.yaml
├── reports/
│   └── validation-report.md
└── delivery-summary.md
```

固定核心文件始终生成。条件文件按以下矩阵处理：

| 产物 | 触发条件 | 未触发时 |
|---|---|---|
| `arcubase/decision.yaml` | 始终 | 不省略；记录 `mode: none` |
| `arcubase/schema.yaml` | `mode: new` 或 `extend` | 省略，并在清单登记 `not-applicable` |
| `arcubase/access-matrix.md` | `mode` 非 `none` | 省略，并登记 `not-applicable` |
| `design/external-station.md` | 任一员工 `station_reachable: true` | 省略 |
| `design/taskboard.md` | 使用 `feat.taskboard` | 省略 |
| `design/browser-webskill.md` | 使用浏览器或 WebSkill 能力 | 省略 |
| `assembly/octopus-cli-dryrun.sh` | CLI 检查成功且至少一个写操作为 `supported` | 省略；清单记录 `not-applicable` 或 `blocked` 及原因 |

第一版只为上表三个条件专题提供专用模板和校验。Ontos、A2UI、Private Service 等能力进入公共能力目录和架构说明，但专用交付模板作为后续扩展点；若项目选择这些能力，生成 `WARNING` 并要求 FDE 补充专项设计，不伪装成已经完整覆盖。

`assembly/operations.yaml` 与 `assembly/assembly-plan.md` 始终生成。CLI 缺失、`--help-json` 无法解析或没有受支持写操作时，前者仍列出 `manual-required/blocked` 操作，后者解释恢复方式，但不得生成空的或未经校验的 dry-run 脚本。

## 9. 结构化事实源与引用规则

`fde-project.yaml` 保存跨文档必须一致的结构化事实：

```yaml
project: {}
sources: []
requirements:
  facts: []
  assumptions: []
  open_questions: []
scenarios: []
roles: []
business_objects: []
workers: []
skills: []
capabilities: []
data_foundation: {}
access_policies: []
assembly: {}
acceptance_cases: []
stage_status: {}
```

员工、Skill、业务对象、角色和数据表使用稳定 ID。Markdown 负责解释与评审，YAML 和 JSON 负责引用与校验。

关键引用示例：

```yaml
workers:
  - id: worker.lead_collector
    skills:
      - skill.lead_intake
    toolkit_keys:
      - feat.arcubase_user

skills:
  - id: skill.lead_intake
    owner_worker: worker.lead_collector
    writes:
      - table.sales_leads

data_foundation:
  mode: new
  tables:
    - id: table.sales_leads
```

稳定 ID 一旦进入已确认方案基线，不因展示名称变化而自动改变。

`data_foundation.tables` 是所有 Arcubase 表的唯一结构化事实源；不得再建立顶层 `tables`。Skill、权限、验收和装配中的表引用都解析到该集合。`mode: none` 时 `tables` 必须为空数组。

## 10. 平台能力参考体系

### 10.1 人工选型知识

每项能力至少描述：

- toolkitKey 或 CLI 能力域。
- 能做什么和不能做什么。
- 适用场景和反例。
- 前置条件。
- 身份和权限要求。
- 风险等级和人在环路要求。
- 影响的交付物。
- 成熟度、更新时间和版本证据。

人工选型知识帮助 AI 做架构判断，不充当 CLI 参数事实源。

机器可校验的 toolkitKey 全集保存在 `catalog/toolkit-keys.yaml`。它是 Kit 对公开能力的版本化权威目录，包含 `catalog_version`、来源修订、验证日期、风险级别和状态。当前 `octopus-cli --help-json` 不提供 toolkitKey，因此不得用 CLI 命令树推导 toolkitKey。

若目标 Team 可用，FDE 可显式授权执行只读的私有员工配置查询，将 Team 实际支持能力与公共目录比较；这个查询不是离线验证的必需步骤。未知 key 始终是 `BLOCKER`，公共目录存在但目标 Team 不支持的 key 在环境检查时升级为 `BLOCKER`。

### 10.2 CLI 与装配契约事实源

`inspect-octopus-cli` 调用当前安装版本的 `octopus-cli --help-json`，生成：

```text
generated/
├── octopus-cli-version.json
├── octopus-cli-help.json
└── cli-command-index.json
```

当前 `octopus-cli` 的 `--help-json` 只提供命令名称、路径、说明和子命令，不提供选项、位置参数、必填字段或 Payload Schema。因此它只作为**命令存在性事实源**，不能单独证明参数或 Payload 正确。

参数与 Payload 的校验来源和优先级为：

1. `schemas/*.schema.json` 和 `catalog/assembly-operations.yaml`：Kit 版本化、经过测试的公开装配契约，定义允许的命令路径、位置参数、选项、Payload Schema 和操作风险。
2. 当前 CLI `--help-json`：确认命令路径是否存在。
3. 具体叶子命令的 `--help`：生成诊断证据并供人工复核，不作为 Payload Schema。
4. `octopus-cli --dryrun`：确认 CLI 能解析命令、JSON、当前 Profile 和 Team并打印计划；它不访问服务端验证业务 Payload Schema，也不代表平台会接受正式请求。

冲突处理：

- 契约要求的命令不存在：该操作转为 `manual-required`；没有人工路径则为 `BLOCKER`。
- CLI 出现契约未登记的写命令：不自动使用，生成 `WARNING`，等待 Kit 维护者补充并测试契约。
- 叶子 `--help` 与契约的参数形状不同：`BLOCKER`，不得生成该操作。

截至设计时，本机 npm 安装包为 `@syngy/octopus-cli@0.1.1`，CLI 自报版本为 `0.1.0`。交付报告必须分别记录包版本和 CLI 自报版本，不假定二者一致。

### 10.3 Arcubase 参考

Arcubase 资料拆为：

- 选型：轻量记忆、专属应用、已有应用或组合方案。
- 建模：App、Table、Field、Link、状态机和派生字段。
- 权限：服务账号、人类角色、硬权限、对话层过滤和外部身份。
- 装配：当前 CLI 暴露的 Arcubase 命令、版本化契约和 dry-run 方式。

新场景需要结构化数据时默认新建专属应用。复用或修改已有共享应用必须由用户明确提出，并披露依赖与风险。

截至设计时，CLI 只暴露 Arcubase App/Table 查询、行查询以及部分组织管理命令，不暴露 App、Table 或 Field 创建。第一版必须把新应用和建表标记为 `admin-manual/manual-required`，输出完整 `schema.yaml` 和人工装配步骤，不生成虚构的 Arcubase 创建命令。

## 11. 校验与错误处理

### 11.1 问题等级

- `BLOCKER`：不允许标记可交付。包括未知 toolkitKey、Skill 缺失、字段引用不存在、权限越界、身份护栏缺失或装配 Payload 非法。
- `WARNING`：允许形成评审稿，但必须披露。包括非关键假设、旧参考版本或目标环境未 dry-run。
- `INFO`：优化建议，不影响交付。

### 11.2 项目状态

- `draft`
- `reviewable`
- `delivery-ready`
- `cli-dryrun-validated`

`cli-dryrun-validated` 只表示当前 CLI 已解析命令、Payload 文件、Profile 和 Team 选择，不表示服务端已经接受 Payload。“文档完整”“CLI 预演通过”和“正式平台验收”必须保持三个不同概念。

项目状态与阶段状态分开。`project.status` 由校验器根据阶段状态和问题等级派生，不允许手工跳级。每个 `stage_status.<stage-id>` 使用：

```yaml
status: not-started | in-progress | needs-review | stale | complete
depends_on: [<stage-id>]
baseline_revision: <non-negative-integer>
input_hashes:
  <relative-path>: <sha256>
output_hashes:
  <relative-path>: <sha256>
approved_at: <ISO-8601-or-null>
```

稳定阶段 ID 和顺序为：

1. `initialize`
2. `discover`
3. `team-design`
4. `foundation-design`
5. `author`
6. `assemble`
7. `validate`

七个阶段对所有项目都必需；不使用 Arcubase 时，`foundation-design` 仍需以 `mode: none` 完成。条件专题不增加阶段，只成为相关阶段的输出。

阶段状态按以下优先级派生，先命中即停止：

1. 该阶段上次记录的任一输入或输出哈希变化：本阶段 `needs-review`，所有下游 `stale`。
2. 任一依赖阶段不是 `complete`：本阶段 `stale`。
3. 存在 staging/工作中标记：`in-progress`。
4. 必需输入、输出、阶段校验和该阶段人审条件全部满足：`complete`。
5. 其他情况：`not-started`。

人审条件为：`initialize` 必须记录项目创建确认；`discover` 必须记录需求基线确认或“按已标注假设继续”的授权；`team-design` 必须记录方案基线确认。其余阶段不要求 `approved_at`，以产物和校验决定 `complete`。交付就绪确认单独记录为 `project.delivery_approved_at`，不参与 `validate` 完成或状态派生。

哈希探测永不自动改写基线。用户审阅修改或阶段重新生成完成后，统一通过 `validate-project --accept-stage <stage-id>` 重新校验该阶段；校验通过且所需人审记录存在时，原子写入当前输入/输出哈希、递增 `baseline_revision` 并把该阶段置为 `complete`。接受当前阶段不会自动接受下游；下游保持 `stale`，直到各自重新生成或审阅并单独接受。

`validate` 阶段只有在结构/交叉校验、公开或客户交付扫描、`package-manifest.json` 生成与校验全部成功后才能 `complete`。这些步骤未运行时为 `not-started/in-progress`，失败时产生 `BLOCKER`，因此不会出现“七阶段完成但打包条件未知”的状态。

项目状态精确定义为：

- `draft`：前三个阶段 `initialize`、`discover`、`team-design` 中任一个不是 `complete`，或其中任一个存在 `BLOCKER`。
- `reviewable`：前三个阶段全部 `complete` 且无这三个阶段的 `BLOCKER`，同时以下至少一项成立：后四个阶段任一个不是 `complete`；全项目存在其他 `BLOCKER`。
- `delivery-ready`：七个阶段均为 `complete`，全项目零 `BLOCKER`，交付扫描和包清单校验通过。
- `cli-dryrun-validated`：先满足 `delivery-ready`，当前项目至少有一个 `support: supported` 的写操作，并且所有这类操作使用同一份产物哈希、用户明确指定的 Profile 和 Team 在同一次验证中 dry-run 成功；`manual-required` 操作不计入 CLI 成功率，但必须保留人工步骤。支持写操作数量为零时最高状态只能是 `delivery-ready`。

### 11.3 校验层级

1. 本地结构与 Schema 校验：始终执行。
2. 装配契约校验：始终执行，使用 Kit 的 Schema 和 `catalog/assembly-operations.yaml`。
3. `--help-json` 命令存在性校验：本机存在 CLI 时执行；缺少 CLI 时生成明确阻断说明和安装指引。
4. 叶子 `--help` 参数形状对照：对计划使用的 CLI 操作执行。
5. `octopus-cli --dryrun`：只有在已有有效登录和明确目标 Team 时执行；不得自动登录或切换 Team。没有 Profile/Team 时仍可达到 `delivery-ready`，但不能标记 `cli-dryrun-validated`。

生成的 `assembly/octopus-cli-dryrun.sh` 必须满足：

- 第一行固定为 `#!/usr/bin/env bash`，唯一支持的解释器为 Bash。
- 每条写命令都包含全局 `--dryrun`。
- 脚本开头再次检查所有 Octopus 命令行都含 `--dryrun`，否则立即退出。
- 不提供删除 `--dryrun` 的参数或环境变量。
- `package-delivery` 在打包前重复执行该检查。
- 正式部署命令只以结构化 `operations.yaml` 表达，不输出可执行生产 Shell。

脚本只能由 `render-dryrun-script` 从已校验的 `operations.yaml` 固定模板生成，不接受任意 Shell 作为输入。操作 ID、Payload 相对路径和命令 path segment 必须匹配 `[a-z0-9][a-z0-9._/-]*`，所有业务值只放 Payload JSON。固定模板使用 `run_octopus_dryrun`，先断言首参数严格等于 `--dryrun`，再执行 `command octopus-cli "$@"`。校验器重新渲染期望字节并与现有脚本逐字节比较，同时运行 `bash -n`；任一差异或语法失败即为 `BLOCKER`。因此不需要对任意 Shell 做不可靠的文本猜测。

### 11.4 交叉检查

校验器至少发现：

- 员工声明了不存在的 Skill。
- Skill 使用了不存在的表或字段。
- toolkitKey 不在当前能力目录。
- 外部 Station 可达员工缺身份核验或访问护栏。
- promptSpec、员工文档和装配 Payload 不一致。
- Skill 引用了自身包外的运行时文件。
- 高风险动作缺少人在环路。
- 验收案例未覆盖主要业务动作、权限或拒绝路径。
- 已确认基线修改后，下游产物未重新生成或复核。

### 11.5 失败矩阵与进程契约

脚本退出码统一为：

- `0`：操作成功，验证无 `BLOCKER`。
- `1`：项目或交付物存在 `BLOCKER`。
- `2`：命令用法、用户输入或参数错误。
- `3`：依赖、文件系统、CLI 或外部运行时错误。

退出码以当前脚本的职责决定：底层探测脚本遇到运行时故障返回 `3`；`validate-project` 把探测结果纳入项目报告后，有 `BLOCKER` 返回 `1`，只有 `WARNING/INFO` 返回 `0`。

| 失败 | 等级/状态影响 | 直接脚本退出码 | `validate-project` | 恢复行为 |
|---|---|---:|---:|---|
| 声明的源文件不存在或不可读 | `BLOCKER`，保持 `draft` | `3` | `1` | 修复路径、权限或明确移除该来源 |
| `fde-project.yaml` 非法 | `BLOCKER`，禁止写下游 | `1` | `1` | 从备份恢复或人工修复 |
| CLI 缺失 | `BLOCKER` 于装配验证，项目可保持 `reviewable` | `3` | `1` | 给出安装指引，不自动安装 |
| `--help-json` 非法或无法解析 | `BLOCKER` 于 CLI 验证 | `3` | `1` | 保留原输出证据，停止生成 CLI 操作 |
| CLI 版本不在已测试范围且参数对照成功 | `WARNING` | `0` | `0` | 记录证据或使用受支持版本 |
| CLI 版本不受支持且参数对照失败 | `BLOCKER` | `1` | `1` | 使用受支持版本或更新契约 |
| toolkitKey 未登记 | `BLOCKER` | `1` | `1` | 修改选型或更新公共目录并评审 |
| Profile 过期、无当前 Team 或 Team 不明确 | `WARNING`，不得进入 `cli-dryrun-validated` | `3` | `0` | 用户自行登录并明确选择 Team |
| dry-run 因语法、JSON 或契约错误失败 | `BLOCKER` | `1` | `1` | 修复生成器或 Payload |
| dry-run 因认证、Profile 或 Team 失败 | `WARNING` | `3` | `0` | 用户修复环境后重试 |
| 必需能力没有 CLI 或人工路径 | `BLOCKER` | `1` | `1` | 调整方案或补充经确认的装配路径 |
| 敏感扫描发现密钥或认证材料 | `BLOCKER` | `1` | `1` | 删除或轮换敏感内容 |
| 写文件中途失败 | 旧文件保持不变 | `3` | 不适用 | 从临时目录诊断并重试 |

所有批量生成先写临时目录、完整校验后原子替换。验证报告即使失败也要写入独立临时报告后原子落盘，包含失败阶段、命令、退出码和恢复建议。

dry-run 包装器永远把底层 CLI 退出码映射到 `0–3`：成功为 `0`；已识别的命令语法、JSON 或契约错误为 `1`；包装器用法错误为 `2`；认证、Profile、Team、CLI 进程异常及未分类错误为 `3`。底层原始退出码和 stderr 只写入诊断报告，不直接作为包装器退出码。

未在表中列出的失败按原因分类：

- `1 domain-invalid`：文件可读且命令调用正确，但项目内容、Manifest、Schema、引用、权限、安全策略或业务契约不合法。
- `2 invocation-invalid`：调用者给脚本的 flag、枚举、参数数量或互斥选项不合法，尚未进入项目验证。
- `3 environment-failure`：文件不存在或无权限、磁盘/原子替换失败、依赖缺失、子进程异常、CLI 输出损坏、网络或认证环境失败。
- 无法分类的异常一律返回 `3`，同时记录异常类型。

因此“不可解析但已成功读取的 YAML/JSON”返回 `1`；“路径不存在或无法读取”返回 `3`。`validate-project` 可以把环境探测失败记录为项目 `BLOCKER` 并返回 `1`，但底层探测脚本仍返回 `3`。

## 12. 公开发布与安全边界

公开 Kit 仓库与客户交付包采用两套策略，不能共用“发现客户标识就阻断”的规则。

### 12.1 公开 Kit 仓库

仓库公开内容采用“可执行但脱敏”原则：

- 保留 toolkitKey、能力说明、CLI 命令形状、Schema 规范和虚构示例。
- 移除内部服务地址、租户信息、真实 ID、认证方式、密钥和客户数据。
- 内部或不稳定能力标记成熟度、版本和管理员授权要求。
- 装配 Payload 使用占位符或虚构案例。
- CI 扫描密钥、内部地址、真实租户和客户数据模式。

客户源文件默认保留在客户项目中，不进入 Kit 仓库，也不自动进入 Git。

公开仓库扫描中，密钥、认证材料、内部域名、真实租户和真实客户标识都是 `BLOCKER`。只有固定虚构 Fixture 可使用仓库级白名单，且白名单条目必须包含模式、原因和对应 Fixture；密钥和认证材料永远不可豁免。

### 12.2 客户交付包

`package-delivery` 的默认边界：

- 包含：确认后的设计文档、员工定义、员工 Skill 包、Arcubase 决策与 Schema、权限矩阵、结构化装配计划、Payload、存在时的 dry-run 脚本、验收文件、脱敏验证报告、交付摘要和 `package-manifest.json`。
- 排除：`inputs/source-files/`、原始绝对路径、备份、临时文件、CLI 凭据、`.env`、认证 Profile、原始命令 stderr、缓存和既有交付压缩包。
- `package-manifest.json` 记录除自身以外每个入包文件的相对路径、SHA-256 和分类，并包含 `self_entry: excluded`；不得尝试记录自身哈希。
- 用户只有显式指定 `--include-sources` 并再次确认敏感风险后才能把源文件加入客户交付包；源文件永不加入 Kit 仓库。

项目模板的 `.gitignore` 至少忽略：

```text
inputs/source-files/
reports/backups/
.tmp/
.env*
generated/
delivery/*.zip
```

客户交付扫描分类为：

- 密钥、Token、Cookie、认证 Profile、`.env`、内部服务地址：始终 `BLOCKER`，不可豁免。
- 当前项目的客户名称和已确认业务标识：允许进入设计交付物，记录为 `INFO`。
- 联系方式、人员信息等个人数据：默认因源文件被排除而不入包；若出现在设计或用户显式 `--include-sources`，必须在打包确认中列出文件和字段，用户确认后才允许。
- 其他客户或其他租户的标识：`BLOCKER`。

客户交付的豁免只保存在该项目的 `reports/package-scan-policy.yaml`，必须精确到文件、检测类别和原因，不得使用宽泛正则，不得提交回公开 Kit 仓库。`package-delivery` 在扫描和确认通过后才创建压缩包，并在失败时删除临时包。

## 13. 最小金标准案例

示例项目是一个内部对话使用的“客户线索收集数字员工”。

固定输入为：

```text
我们是星河科技，需要一个内部数字员工帮助销售登记客户线索。
销售会在平台内发来公司、联系人、电话、需求和来源。
信息不全要追问，疑似重复要提示，销售确认后才能登记。
销售只能查询自己提交的线索，销售经理可以查看全部。
第一版不接飞书、企微或微信，不自动分配，不对外发送消息。
```

固定确认答案为：项目名“星河科技客户线索收集数字员工”、目录 `xinghe-lead-collector-fde`、入口 `new`、新建专属 Arcubase 应用、内部对话、销售与销售经理两个组织角色。

`role.intern` 只存在于安全测试夹具，表示不在允许角色集合中的对抗身份，不是项目要创建或配置的第三个组织角色。

### 13.1 数字员工

- 名称：小采 · 线索收集专员。
- 职责：收集、补齐、确认并登记客户线索。
- 服务对象：销售及管理人员。
- 外部 Station：不启用。
- toolkitKeys：`feat.arcubase_user`、`feat.organization_view`。

### 13.2 业务 Skill

`collect-sales-leads` 执行：

1. 接收自然语言线索。
2. 提取公司、联系人、联系方式、需求和来源。
3. 追问缺失的关键字段。
4. 查询疑似重复线索。
5. 展示待登记摘要。
6. 用户明确确认后写入。
7. 返回记录 ID 和登记结果。

### 13.3 数据地基

新建专属 Arcubase 应用和一张 `sales_leads` 表。固定 Schema 为：

| 字段 ID | key | 类型 | 必填/规则 |
|---|---|---|---|
| 1001 | `company_name` | `text` | 必填，去首尾空格 |
| 1002 | `contact_name` | `text` | 必填 |
| 1003 | `contact_method` | `text` | 必填，保留用户原值并生成规范化比较值 |
| 1004 | `requirement_summary` | `textarea` | 必填 |
| 1005 | `source` | `select` | 必填：1 转介绍、2 官网、3 展会、4 其他 |
| 1006 | `submitter_arcubase_user_id` | `text` | 必填，来自 Current Speaker |
| 1007 | `submitter_name` | `text` | 必填，组织成员姓名快照 |
| 1008 | `status` | `select` | 必填，默认 1：1 新线索、2 跟进中、3 已转化、4 已作废 |
| 1009 | `created_at` | `datetime` | 必填，Unix 秒 |

重复规则固定为：`company_name` 小写、去首尾及连续空白后相同，且 `contact_method` 去空格和常见分隔符后相同，并存在 `status != 4` 的记录，即为疑似重复。疑似重复只提示现有记录摘要，未经用户再次确认不得新增。

数字员工服务账号具有读写权限，管理角色只读。普通销售不直接访问全表，通过数字员工登记并查询自己提交的线索。不提供删除，无效线索使用状态字段。

### 13.4 验收案例

Fixture 时钟固定为 `2026-07-24T01:00:00Z`，语言为 `zh-CN`，时区为 `Asia/Shanghai`。Fixture 内稳定 ID、字段 ID、select key 和文件排序均固定；运行时平台 ID 一律使用具名占位符，不生成随机 UUID。

固定 ID 为：

```yaml
worker: worker.lead_collector
skill: skill.collect_sales_leads
app: app.lead_collection
table: table.sales_leads
roles:
  sales: role.sales
  sales_manager: role.sales_manager
  intern: role.intern
speakers:
  zhang_nan: user.fixture.sales.zhang_nan
  chen_chen: user.fixture.manager.chen_chen
  intern: user.fixture.intern
```

规范化算法固定为 Unicode NFKC。公司名去首尾空白、把连续 Unicode 空白折叠为一个 ASCII 空格，再做 locale-independent lowercase。Fixture 中的电话比较值删除 ASCII/Unicode 空白、`-`、`(`、`)`，保留其余字符；因此 `138 0000 0001` 与 `138-0000-0001` 相同。

预置一条用于重复测试的记录：

```yaml
company_name: 杭州清禾食品有限公司
contact_name: 李明
contact_method: "138 0000 0001"
requirement_summary: 希望了解样品和经销政策
source: 3
submitter_arcubase_user_id: user.fixture.sales.zhang_nan
submitter_name: 张楠
status: 1
created_at: 1784854800
```

行为用例固定为：

| 用例 | 身份与输入 | 固定期望 |
|---|---|---|
| 完整登记 | 销售张楠：“登记苏州星禾包装有限公司，王芳，13900000002，希望了解经销商线索管理，来源展会”→“确认登记” | 展示九字段摘要后恰好创建一行；`source=3`、`status=1`、时间为 Fixture 时钟 |
| 缺少联系方式 | 销售张楠：“登记苏州启明包装，联系人赵蕾，需要报价，来源转介绍” | 只追问联系方式，不写入 |
| 疑似重复 | 销售张楠：“登记 杭州清禾食品有限公司，李明，138-0000-0001，需要样品，展会”→“取消” | 展示预置重复记录摘要并询问是否仍新增；取消后零写入 |
| 摘要取消 | 销售张楠提交完整、非重复线索→“取消” | 返回已取消，零写入 |
| 未授权全量查询 | 实习生角色：“列出所有销售线索” | 身份校验后拒绝，不调用业务表查询 |
| 销售本人查询 | 销售张楠：“查看我提交的线索” | 查询条件包含张楠的 Current Speaker ID，不返回他人记录 |
| 经理查询 | 销售经理陈晨：“查看全部线索” | 角色校验通过，可查询全部 |
| 静态一致性 | 运行项目校验 | Skill 字段、员工 Skill、toolkitKeys、权限和状态值全部匹配 |
| 装配预演 | 有明确 Profile/Team 时运行 dry-run | 支持的 CLI 操作预演通过；Skill 上传和 Arcubase 建表保持 `manual-required` |

示例只使用上述虚构公司、人员和联系方式。

预期产物的精确文件集为：

```text
fde-project.yaml
inputs/input-inventory.md
discovery/facts-and-assumptions.md
discovery/open-questions.md
discovery/scenario-model.md
design/team-design.md
design/collaboration-and-dataflow.md
design/platform-capability-selection.md
design/data-foundation.md
design/identity-and-access.md
employees/lead-collector.md
skills/collect-sales-leads/SKILL.md
arcubase/decision.yaml
arcubase/schema.yaml
arcubase/access-matrix.md
assembly/assembly-plan.md
assembly/operations.yaml
assembly/octopus-cli-dryrun.sh
assembly/payloads/team-private-digiworker-create.json
acceptance/acceptance-plan.md
acceptance/test-cases.yaml
reports/validation-report.md
delivery-summary.md
```

`assets/examples/lead-collector/expected-artifacts.yaml` 必须逐项列出这 23 个路径，Golden 生成缺少或多出任一文件都失败。当前 CLI 不支持的普通 Skill 上传、Skill-set 创建和绑定、Arcubase 建表只写入 `operations.yaml` 和 `assembly-plan.md` 的人工操作，不产生虚构 Payload 文件。Golden 校验结果必须为零 `BLOCKER`。

比较方法：

- Golden 不读取开发机全局 CLI。`assets/examples/lead-collector/cli-fixture/` 固定保存 npm 包版本 `0.1.1`、CLI 自报版本 `0.1.0`、完整 `help-json` 和本案例使用叶子命令的 `--help` 文本。接口固定为 `inspect-octopus-cli --fixture-dir <dir>`；该选项与真实 CLI 路径参数互斥，并禁止启动 `octopus-cli` 子进程。真实已安装 CLI 只用于独立兼容性测试，不能重写 Golden。
- YAML/JSON 解析后必须是仅含 string/number/boolean/null、string-key object 和 array 的 JSON 数据模型；拒绝 YAML tag、anchor、非字符串 key 和非有限数字。随后按 RFC 8785 JSON Canonicalization Scheme 序列化为 UTF-8 字节并计算 SHA-256；object key 递归排序、array 顺序保留，字符串不做额外 Unicode 归一化。
- Markdown 统一 LF、删除行尾空白；不计算全文哈希。`expected-artifacts.yaml` 为每个 Markdown 明确列出按顺序出现的 `required_literals` 和不得出现的 `forbidden_literals`，比较器只执行精确字面量包含和顺序检查，不抽取未定义的“结构片段”。
- `created_at` 等时间使用 Fixture 时钟。
- 文件路径先转为 `/` 分隔的 UTF-8 相对路径，再按 UTF-8 字节字典序排序。`expected-artifacts.yaml` 对 YAML/JSON 保存规范化内容的 SHA-256，对 Markdown 保存 `sha256: null` 和上述字面量断言。
- `assembly/octopus-cli-dryrun.sh` 固定为 UTF-8、LF、POSIX mode `0755`。其 SHA-256、文件模式和以下安全字面量都写入期望清单：`set -euo pipefail`、封装函数只接受首参数 `--dryrun`、受支持 CLI 操作均经该函数调用；禁止出现不带 `--dryrun` 的 `octopus-cli` 执行行。普通测试不得自动更新任何期望哈希，更新 Golden 必须走显式维护命令并人工审查 diff。

Golden CLI 桩固定把默认示例中的 `team-private-digiworker.create` 标为 `supported`，并生成 live-gated assembly：`configure team private-digiworkers add`。普通 Skill 上传、Skill-set 创建和绑定、新建 Arcubase App 和建表为 `manual-required`。脚本通过单一 `run_octopus_assemble` 函数执行一个操作，Payload 文件为 `team-private-digiworker-create.json`。

## 14. 安装、更新与版本

仓库采用 Apache-2.0。安装器支持：

```bash
./scripts/install --target codex
./scripts/install --target claude-code
./scripts/install --target both
```

默认将同一仓库符号链接到：

```text
~/.agents/skills/design-aiworker-solutions
~/.claude/skills/design-aiworker-solutions
```

安装接口为：

```text
scripts/install --target codex|claude-code|both
                --mode symlink|copy
                [--update]
                [--replace]
```

- 默认 `--mode symlink`。
- 目标不存在时创建；已经指向当前仓库时幂等成功。
- 目标存在且不是当前安装时退出码 `1`，除非用户显式给出 `--replace`。
- `--replace` 先把旧目标移动到带时间戳的同级备份，再安装；失败时恢复备份。
- `--update` 与 `--replace` 互斥；同时提供时退出码 `2`。
- Copy 模式的更新必须使用 `--update`，并检查安装清单中的源 commit；安装清单缺失或检测到安装目录内的用户修改时拒绝覆盖并给出差异，用户只能先处理差异或改用 `--replace`。
- Copy 更新先复制到同级 staging 目录并验证，再把旧目录移动为备份、原子替换；失败时恢复旧目录。
- Symlink 模式下，链接已经指向当前仓库时 `--update` 为幂等检查，不执行 `git pull`；链接指向其他仓库或失效时按冲突处理。
- `--target both` 采用全有或全无：先预检两个目标并准备 staging/备份，任一目标失败就回滚另一个目标。
- Codex 安装必须验证根 `SKILL.md` 和 `agents/openai.yaml`；Claude Code 安装只要求根 `SKILL.md`。两种模式都运行一次只读发现检查。

安装清单保存在：

```text
${XDG_CONFIG_HOME:-$HOME/.config}/aiworker-fde-kit/installations/codex.json
${XDG_CONFIG_HOME:-$HOME/.config}/aiworker-fde-kit/installations/claude-code.json
```

清单 Schema 为：

```yaml
schema_version: 1
target: codex | claude-code
mode: symlink | copy
target_path: <absolute-path>
source_path: <absolute-realpath>
source_commit: <git-sha-or-null>
source_dirty: <boolean>
source_tree_hash: <sha256>
installed_at: <ISO-8601>
files:
  <relative-path>:
    type: file | symlink
    sha256: <sha256-or-null>
    mode: <four-digit-octal>
    link_target: <string-or-null>
```

跟踪文件集固定为 `SKILL.md`、`agents/**`、`references/**`、`catalog/**`、`assets/project-template/**`、`assets/examples/**`、`schemas/**`、`scripts/**` 和 `LICENSE`；排除 `.git/**` 与 `docs/**`。扫描时枚举当前跟踪目录下的**全部**文件和符号链接，比较路径集合、类型、mode、链接目标和内容哈希，因此新增、删除、改名、类型变化和权限位变化都能被发现。

普通文件对原始字节计算 SHA-256；符号链接不跟随，记录 `link_target` 且 `sha256: null`。`source_tree_hash` 对按 UTF-8 相对路径字节序排列的 `path + NUL + type + NUL + mode + NUL + sha256-or-empty + NUL + link-target-or-empty + LF` 记录整体计算 SHA-256。

Copy 更新先用清单中的完整路径集合与目标目录重算快照，任何差异都视为用户修改并拒绝覆盖；再对当前源文件集计算新树哈希并执行事务更新。`source_path` 与清单不同则退出码 `1`，需使用 `--replace`。源 commit 变化是正常更新，不要求后代关系；非后代 commit 生成 `WARNING`。缺少 Git 元数据时 `source_commit: null` 并生成 `WARNING`。源工作树有未提交修改时允许安装当前快照，但必须显示 `WARNING` 并记录 `source_dirty: true`。安装清单缺失、损坏或与目标路径不匹配时，`--update` 退出码 `1`。

Symlink 模式也写独立清单，但 `files` 记录安装时源文件快照，仅用于诊断；链接指向当前 `source_path` 即视为幂等，源工作树后续变化自然生效并由 `source_tree_hash` 差异提示。

预检真值表：

| 目标 | 清单 | 默认结果 |
|---|---|---|
| 不存在 | 不存在 | 允许全新安装 |
| 存在且与清单一致 | 存在且合法 | 允许幂等检查或 `--update` |
| 存在 | 不存在、损坏或路径不匹配 | 冲突，退出码 `1`；仅 `--replace` 可修复 |
| 不存在 | 存在 | 孤儿清单冲突，退出码 `1`；仅 `--replace` 可备份清单后重装 |
| 失效符号链接、类型不符或文件集合不一致 | 任意 | 冲突，退出码 `1`；仅 `--replace` 可修复 |

安装器不自动猜测或修复不一致对。`--replace` 也必须把现有目标和现有清单（存在者）一起备份后再重装。

所有安装和更新把“目标 + 安装清单”作为一个事务：

1. 预检所有目标并在同级准备新目标及新清单临时文件。
2. 把旧目标和旧清单移动到备份位置。
3. 原子提交新目标，再原子提交新清单。
4. 执行安装后发现检查。
5. 任一步失败，删除已提交的新目标/清单并恢复旧目标和旧清单。

`--target both` 把两个目标和两份清单纳入同一个事务；四者全部提交且检查通过后才删除备份。文件 mode 在复制和恢复时必须保留，确保 `scripts/**` 的可执行位不丢失。

`main` 始终保持可用，面向需要最新版的 FDE。稳定里程碑使用语义化 Git Tag 和 GitHub Release。客户交付包记录：

- Kit commit SHA。
- Kit Release 版本。
- `octopus-cli` npm 包版本。
- CLI 自报版本。
- 生成时间。
- 校验层级和目标环境状态。

Skill 检测不到 `octopus-cli` 时只提供安装指引，不自动全局安装。

## 15. CI 与测试

GitHub CI 至少覆盖：

- Skill frontmatter 和目录结构。
- JSON Schema。
- 参考文件链接。
- toolkitKey 格式与唯一性。
- 最小参考项目的确定性完整验证。
- 员工、Skill、Arcubase、权限和装配 Payload 交叉校验。
- `octopus-cli --help-json` 兼容性。
- Codex 与 Claude Code 两种安装布局。
- 敏感信息扫描。

确定性工具链回归与 Agent 行为评估分开：

- `scripts/test-example --example lead-collector` 把已签入的 `expected-project/` 复制到临时目录，调用 `validate-project --cli-fixture-dir <checked-in-fixture>`、重新渲染 dry-run 脚本并按 `expected-artifacts.yaml` 比较。它验证模板、Schema、目录、校验器、打包边界和 CLI 桩，不调用 LLM，也不声称生成方案。
- Agent forward-test 使用 `input/` 中的固定需求，在全新临时目录调用 Skill。由于可读 prose 允许合理差异，只要求生成的项目通过同一 Schema、交叉检查、文件集合和行为用例，不与 Golden prose 做逐字或哈希比较。

Skill 的 Agent 行为验证采用先基线、后实现、再复测的方式：

1. 在没有本 Skill 的情况下，让独立 Agent 处理同一个最小案例，记录缺失交付物、错误能力选择和一致性问题。
2. 实现最小 Skill 与校验器。
3. 使用同一输入重新测试，要求完整生成并通过校验。
4. 增加资料冲突、缺失 CLI、无目标 Team、外部 Station、已有半成品项目等变体测试。

### 15.1 完成标准归属

| 完成要求 | 主要契约 | 所属脚本 | Fixture / CI |
|---|---|---|---|
| 三种入口与初始化确认 | `project.schema.json` | `init-project` | new/materials/resume fixtures |
| 固定与条件产物矩阵 | `project.schema.json` + 第 8 节 | `validate-project` | none/Arcubase/Station fixtures |
| 员工与 Skill 一致 | `worker.schema.json` | `validate-project` | lead-collector golden |
| Arcubase 字段与权限一致 | `arcubase.schema.json` | `validate-project` | lead-collector golden |
| toolkitKey 合法 | `catalog/toolkit-keys.yaml` | `validate-project` | catalog contract test |
| CLI 操作存在且参数匹配 | `catalog/assembly-operations.yaml` | `inspect-octopus-cli` | installed CLI compatibility test |
| Payload 合法且只生成 dry-run Shell | `assembly.schema.json` | `validate-project` | mutation-safety test |
| 公开包无敏感内容 | package boundary + scan allowlist | `package-delivery` | secret/redaction fixtures |
| Codex/Claude 可安装更新 | 安装接口 | `install` | isolated HOME layout tests |

## 16. 完成标准

第一版同时满足以下条件才算完成：

- 公开仓库可被 Codex 和 Claude Code 安装。
- 三种入口均有明确工作流。
- 项目名称和目录创建前经过用户确认。
- 固定核心交付物可生成，条件专题按需出现。
- 最小线索收集参考项目通过确定性完整验证，Agent forward-test 生成的新项目通过相同不变量校验。
- `fde-project.yaml`、文档、员工 Skill、Arcubase 和装配 Payload 交叉一致。
- CLI 命令存在性来自 `--help-json`，参数与 Payload 来自版本化装配契约并经叶子 `--help` 和 Schema 对照，不存在猜测命令。
- 无 Profile/Team 时可生成 `delivery-ready` 包，有明确 Profile/Team 时可进一步达到 `cli-dryrun-validated`。
- 零 `BLOCKER` 才能打包。
- 第一版不生成可执行生产写操作的 Shell；唯一 Shell 只允许带 `--dryrun`，并由两层防护检查。
- CLI 未覆盖的 Skill 上传和 Arcubase 建表以明确的 `admin-manual/manual-required` 交付，不声称已自动化。
- 公开仓库不包含密钥、内部地址、真实租户或客户数据。
