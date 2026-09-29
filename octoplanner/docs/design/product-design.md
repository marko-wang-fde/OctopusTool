# Octoplanner Product Design

状态：Draft  
更新时间：2026-06-04  
工程目录：`/Users/wanglei/Projects/syngy/octoplanner`

## 1. 定位

`octoplanner` 是面向 AI Agent 的生产排程 CLI。它提供一套有产品主张的排产领域模型，接受标准 JSON 输入，在本地 SQLite 工作区中管理模型、规则、计划、试算场景和审计记录。

`octoplanner` 不负责连接 ERP、解析任意 Excel、识别客户字段，也不直接依赖 Ontos。本体、ERP connector、Excel 转换、字段对齐和写回执行系统由 Agent 或外部适配器负责。它们最终必须把数据转换成 `octoplanner` 定义的标准模型。

一句话边界：

```text
Agent 负责理解、接入、转换、解释、审批、写回。
octoplanner 负责排产领域模型、规则应用、计划生成、影响分析、试算重排和可解释输出。
```

## 2. 设计原则

1. 领域模型优先，所有输入都落到明确的排产对象。
2. 模型字段可选，约束可选，目标可选；但输入格式必须受 schema 约束。
3. 用户可以直接表达排产规则，不需要证明完整因果链。
4. 计划变更先试算，再提交；避免 CLI 替用户直接做业务决策。
5. 每次输出都要说明：已建模什么、应用了哪些规则、哪些因素未建模。
6. 甘特图是计划视图，不是运算模型。

## 3. 核心对象

### 3.1 Model

`model` 是排产计算的基础数据集合。它包含以下领域对象：

- `requirement`：需求。覆盖销售订单、预测需求、人工插单、补产需求等。
- `item`：产品/零件主数据。
- `routing`：工艺路线与工序定义。
- `resource`：机床、产线、工位、资源组等。
- `supply`：物料、前序产出、外协、采购承诺等供给可用性。

这些对象都通过 `model <object> load --file <json>` 加载。CLI 不从 Excel 或 ERP 原始格式中猜字段。

### 3.2 Rule

`rule` 是用户或 Agent 直接给出的排产控制条件。

它可以是事实，也可以是人工判断或假设。用户不需要说明完整原因。例如：

```text
订单 601269028 在 2026-03-12 前不要开工。
S-43 机床 2026-03-10 到 2026-03-13 不可用。
OP-001 已确认，不要移动。
订单 202061549 优先级提高。
```

`rule` 保持顶层命令，不放入 `model` 内部，因为它是计划交互与重排控制入口，不是基础业务模型。

### 3.3 Case

`case` 是一次排产测算上下文。它选择一组模型数据、规则和可选基准计划，形成一次可验证的排产输入。

```text
case = model(requirement, item, routing, resource, supply) + rules + optional baseline plan
```

### 3.4 Plan

`plan` 是正式排产方案。它包含工序级资源占用、未排项、延期风险、指标、解释信息和视图数据。

人工排产表转换后也可以通过 `plan load` 作为基准计划导入，用于后续重排和对比。

### 3.5 Scenario

`scenario` 是基于某个正式计划创建的试算分支。它用于在不改变正式计划的情况下叠加规则、分析影响、试算重排、比较候选方案。

只有 `scenario commit` 后，候选方案才变成新的正式 `plan`。

## 4. 命令树

```text
octoplanner
  workspace
    init
    status
    config
    doctor

  schema
    list
    show
    check
    example

  model
    requirement
      load
      list
      show
      validate
      summary
    item
      load
      list
      show
      validate
    routing
      load
      list
      show
      validate
      coverage
    resource
      load
      list
      show
      validate
      timeline
    supply
      load
      list
      show
      validate
      availability

  rule
    add
    load
    list
    show
    remove
    enable
    disable
    expire
    validate

  case
    create
    list
    show
    validate
    summary
    export

  plan
    create
    load
    list
    show
    summary
    timeline
    metrics
    export
    compare
    archive

  impact
    analyze
    trace

  scenario
    create
    list
    show
    simulate
    compare
    commit
    discard

  explain
    plan
    requirement
    order
    operation
    resource
    rule
    scenario

  audit
    log
    show
```

## 5. 命令说明

### 5.1 workspace

管理本地 SQLite 工作区。

| 命令 | 含义 |
| --- | --- |
| `workspace init` | 初始化 `.octoplanner/` 和 SQLite 数据库。 |
| `workspace status` | 查看当前工作区、数据库版本、模型批次、计划和规则数量。 |
| `workspace config` | 查看或设置默认时区、默认输出格式、默认求解策略等。 |
| `workspace doctor` | 检查数据库、schema 版本、索引、引用完整性和工作区可用性。 |

### 5.2 schema

公开 `octoplanner` 的标准输入/输出格式。

| 命令 | 含义 |
| --- | --- |
| `schema list` | 列出可用 schema，例如 `model.requirement`、`model.routing`、`plan`。 |
| `schema show` | 输出指定 schema。 |
| `schema check` | 校验 JSON 文件是否符合指定 schema。 |
| `schema example` | 生成指定 schema 的示例 JSON。 |

### 5.3 model requirement

管理需求输入。`requirement` 可以表达订单、预测、插单、补产和人工需求。

| 命令 | 含义 |
| --- | --- |
| `model requirement load` | 加载标准需求 JSON。 |
| `model requirement list` | 列出需求批次或需求行。 |
| `model requirement show` | 查看某个需求或需求批次详情。 |
| `model requirement validate` | 校验需求字段、数量、交期、优先级、引用关系。 |
| `model requirement summary` | 汇总需求数量、未交数量、交期分布、优先级分布。 |

典型字段：

```ts
type Requirement = {
  id: string
  itemId: string
  quantity: number
  dueAt?: string
  priority?: number
  customer?: string
  vehicleModel?: string
  attributes?: Record<string, string>
  externalRef?: ExternalRef
}
```

### 5.4 model item

管理产品/零件主数据。

| 命令 | 含义 |
| --- | --- |
| `model item load` | 加载产品/零件主数据。 |
| `model item list` | 列出产品/零件。 |
| `model item show` | 查看某个产品/零件详情。 |
| `model item validate` | 校验主数据格式和可选分类字段。 |

可选字段包括材料、材料形态、工艺族、换模组、客户型号等。没有这些字段时不能报错，只能在输出中标记为未建模因素。

### 5.5 model routing

管理工艺路线和工序模板。

| 命令 | 含义 |
| --- | --- |
| `model routing load` | 加载工艺路线 JSON。 |
| `model routing list` | 列出工艺路线。 |
| `model routing show` | 查看某个产品的工艺路线。 |
| `model routing validate` | 校验工序顺序、前后置、资源引用、时间字段。 |
| `model routing coverage` | 检查哪些需求缺少工艺路线。 |

工艺路线是生成工序级排程的关键输入。若某个需求缺少路线，`case validate` 应明确提示该需求无法自动排程。

### 5.6 model resource

管理资源，包括机床、产线、工位、资源组。

| 命令 | 含义 |
| --- | --- |
| `model resource load` | 加载资源 JSON。 |
| `model resource list` | 列出资源和资源组。 |
| `model resource show` | 查看资源能力、可选日历、停机窗口。 |
| `model resource validate` | 校验资源引用和可选可用性规则。 |
| `model resource timeline` | 查看资源在某个计划或场景中的占用时间轴。 |

班次日历、并行能力、停机窗口是可选字段。缺失时默认只执行资源不重叠约束。

### 5.7 model supply

管理供给可用性，包括物料、前序产出、采购、外协等。

| 命令 | 含义 |
| --- | --- |
| `model supply load` | 加载供给/缺件/物料可用性 JSON。 |
| `model supply list` | 列出供给记录。 |
| `model supply show` | 查看某个 item 或 material 的供给详情。 |
| `model supply validate` | 校验供给数量、可用时间、引用关系。 |
| `model supply availability` | 查询某个物料或前序产出在某时间是否可用。 |

`supply` 不是完整 MRP。它只表达排产所需的供给约束，例如“某物料不早于某天可用”。

### 5.8 rule

管理用户/Agent 的直接排产控制。

| 命令 | 含义 |
| --- | --- |
| `rule add` | 添加一条规则。 |
| `rule load` | 从标准 JSON 批量加载规则。 |
| `rule list` | 列出规则。 |
| `rule show` | 查看规则详情。 |
| `rule remove` | 删除规则。 |
| `rule enable` | 启用规则。 |
| `rule disable` | 禁用规则但保留记录。 |
| `rule expire` | 设置规则过期，适合临时判断。 |
| `rule validate` | 校验规则目标、时间范围和冲突情况。 |

首期规则类型：

```text
not-start-until
not-finish-after
resource-unavailable
lock-operation
lock-requirement
avoid-resource
prefer-resource
priority-boost
must-run-before
must-run-after
supply-not-available-until
```

示例：

```bash
octoplanner rule add \
  --type not-start-until \
  --target requirement:601269028 \
  --until 2026-03-12 \
  --reason "前置条件可能无法按时完成"
```

### 5.9 case

管理排产测算上下文。

| 命令 | 含义 |
| --- | --- |
| `case create` | 从模型批次、规则和可选基准计划创建排产上下文。 |
| `case list` | 列出 case。 |
| `case show` | 查看 case 包含的模型、规则和基准计划。 |
| `case validate` | 校验是否可排程，并输出已建模/未建模因素。 |
| `case summary` | 汇总需求、工序、资源、规则、供给约束。 |
| `case export` | 导出可复现的 case JSON。 |

`case validate` 不应因为缺少可选模型而失败。例如没有班次、换模、物料供给时，可以继续排程，但必须输出：

```json
{
  "notModeled": [
    "shift_calendar",
    "changeover_cost",
    "material_availability"
  ]
}
```

### 5.10 plan

管理正式计划。

| 命令 | 含义 |
| --- | --- |
| `plan create` | 基于 case 生成正式计划。 |
| `plan load` | 加载已有人工计划或外部计划的标准 JSON。 |
| `plan list` | 列出计划版本。 |
| `plan show` | 查看计划详情。 |
| `plan summary` | 汇总延期、未排、资源占用、规则应用情况。 |
| `plan timeline` | 输出甘特图/时间轴数据。 |
| `plan metrics` | 输出指标，例如延期、扰动、资源利用率、换模次数。 |
| `plan export` | 导出计划 JSON/CSV。 |
| `plan compare` | 比较两个正式计划。 |
| `plan archive` | 归档旧计划。 |

### 5.11 impact

在重排前做影响分析。

| 命令 | 含义 |
| --- | --- |
| `impact analyze` | 分析新增规则或场景对计划的影响范围。 |
| `impact trace` | 追踪某个需求、工序或资源为什么被影响。 |

影响分析输出应包含：

- 受影响需求。
- 受影响工序。
- 被阻塞的前后置链。
- 可前移的候选工序。
- 可能发生连锁重排的资源。
- 原计划扰动范围。

### 5.12 scenario

管理试算分支。

| 命令 | 含义 |
| --- | --- |
| `scenario create` | 从正式计划创建试算场景，可叠加规则。 |
| `scenario list` | 列出场景。 |
| `scenario show` | 查看场景、基准计划、规则和候选方案。 |
| `scenario simulate` | 试算重排，支持 `repair` 和 `optimize` 模式。 |
| `scenario compare` | 比较候选方案。 |
| `scenario commit` | 将候选方案提交为正式 plan。 |
| `scenario discard` | 丢弃试算场景。 |

`repair` 模式优先少动原计划。`optimize` 模式允许更大范围重排以改善目标指标。

### 5.13 explain

解释计划、规则和重排结果。

| 命令 | 含义 |
| --- | --- |
| `explain plan` | 解释整个计划的主要取舍。 |
| `explain requirement` | 解释某个需求为什么这样排、是否延期、受哪些规则影响。 |
| `explain order` | `explain requirement` 的别名，方便订单语境。 |
| `explain operation` | 解释某道工序的时间、资源选择和前后置。 |
| `explain resource` | 解释资源占用、空档、瓶颈和冲突。 |
| `explain rule` | 解释某条规则影响了哪些对象。 |
| `explain scenario` | 解释试算方案相对基准计划的变化。 |

### 5.14 audit

保留可追溯记录。

| 命令 | 含义 |
| --- | --- |
| `audit log` | 查看模型加载、规则变更、计划生成、场景提交等流水。 |
| `audit show` | 查看某一次操作的输入摘要、输出摘要和执行状态。 |

## 6. 典型流程

### 6.1 从标准模型创建计划

```bash
octoplanner workspace init

octoplanner model requirement load --file requirements.json
octoplanner model item load --file items.json
octoplanner model routing load --file routings.json
octoplanner model resource load --file resources.json
octoplanner model supply load --file supplies.json

octoplanner case create --name march-case
octoplanner case validate --case march-case
octoplanner plan create --case march-case --name march-plan
octoplanner plan timeline --plan march-plan --format json
```

### 6.2 用户直接添加规则后试算重排

用户不需要说明完整因果链，只表达排程控制：

```bash
octoplanner rule add \
  --type not-start-until \
  --target requirement:601269028 \
  --until 2026-03-12 \
  --reason "前置条件可能无法按时完成"

octoplanner impact analyze --plan march-plan --rule latest

octoplanner scenario create \
  --from-plan march-plan \
  --name delay-601269028

octoplanner scenario simulate \
  --scenario delay-601269028 \
  --mode repair \
  --objective minimal-disruption

octoplanner scenario compare --scenario delay-601269028
octoplanner scenario commit --scenario delay-601269028 --as-plan march-plan-v2
```

### 6.3 已有人人工计划作为基准

```bash
octoplanner plan load --file baseline-plan.json --name manual-plan
octoplanner rule add --type resource-unavailable --target resource:S-43 --from 2026-03-10 --to 2026-03-13
octoplanner impact analyze --plan manual-plan --rule latest
octoplanner scenario create --from-plan manual-plan --name s43-down-repair
octoplanner scenario simulate --scenario s43-down-repair --mode repair
```

## 7. 与样例业务的映射

会议纪要和三份表格能映射到当前抽象，但转换不属于 `octoplanner` 职责。

| 业务材料 | 对应模型 | 说明 |
| --- | --- | --- |
| 销售发货计划 | `model requirement` | 订单日期、到期日、单据编号、客户、物料、数量、未交数量、优先级。 |
| 物料/缺件表 | `model supply` | 物料可用性、缺件数量、采购/生产责任人、预计交期。 |
| 机加排产登记表 | `plan load` | 人工排产快照，可作为 baseline plan。 |
| 工艺路线资料 | `model routing` | 产品到工序、工序顺序、可用资源、设备占用时间。 |
| 机床清单 | `model resource` | 机床、产线、资源组、可选停机窗口。 |
| 计划员人工判断 | `rule` | 不早于某天开工、锁定某工序、资源不可用、优先级调整。 |

## 8. 非目标

首期明确不做：

- 直接解析任意 ERP、SAP、MES、Excel 原始格式。
- 自动从客户字段猜测语义。
- 完整 MRP BOM 展开。
- 完整 APS 系统。
- 前端甘特图编辑器。
- 自动写回 ERP/MES。
- 默认假设已理解所有物料、班次、模具、换料、人员约束。

## 9. 输出要求

所有命令默认输出 JSON，适合 Agent 消费。面向人的表格输出可以通过 `--format table` 启用。

关键输出必须包含：

- `ok`：是否成功。
- `data`：命令结果。
- `warnings`：可继续但需注意的问题。
- `notModeled`：未建模因素。
- `appliedRules`：本次应用的规则。
- `auditId`：审计记录 ID。

失败必须 fast fail，并给出可执行修复信息。不能静默吞错，也不能用猜测式 fallback。

## 10. 首期建议实现范围

首期主链路：

```text
workspace init
schema list/show/check/example
model requirement load/list/show/validate/summary
model item load/list/show/validate
model routing load/list/show/validate/coverage
model resource load/list/show/validate
rule add/load/list/show/validate
case create/show/validate/summary/export
plan create/load/show/summary/timeline/export
impact analyze
scenario create/show/simulate/compare/commit
explain requirement/operation/resource/rule/scenario
audit log/show
```

可延后：

```text
model supply availability
model resource timeline
plan metrics
plan compare
plan archive
impact trace
scenario discard
rule expire/enable/disable/remove
```
