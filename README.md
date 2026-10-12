# Octopus 开发资源目录说明

`开发资源` 是小章鱼 FDE 场景设计、Workbench 应用开发、Host API 接入和辅助工具的通用资料集，整体分为三部分：

- `OctopusDoc/`：方法论、场景指南和可执行开发 Skill。
- `OctopusSDK/`：小章鱼官方 TypeScript/JavaScript 客户端 SDK。
- `OctopusTool/`：Skill 工程化工具和平台侧辅助程序。

## 一、总体目录结构

```text
开发资源/
├── OctopusDoc/
│   ├── README.md
│   ├── guide/
│   │   ├── introduction/
│   │   ├── crido-scenario-analysis/
│   │   ├── team-solution-design/
│   │   ├── triggers-and-task-orchestration/
│   │   ├── enterprise-access-and-execution/
│   │   ├── data-knowledge-and-business-objects/
│   │   ├── vibe-coding-and-workbench/
│   │   ├── acceptance-and-maturity/
│   │   ├── case-patterns/
│   │   └── reference/
│   └── skills/
│       └── workbench-vibe-coding-flow/
│           ├── SKILL.md
│           └── agents/
│               └── openai.yaml
├── OctopusSDK/
│   └── syngy-octopus-client-0.1.5-official-sdk.zip
└── OctopusTool/
    ├── meta-skill-v3.10.1.zip
    └── octopus-helper-v0.1.10-windows-amd64.exe.zip
```

## 二、`guide/` 各专题说明

| 文件夹                                 | 中文含义                      | 主要作用                                                     |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `introduction/`                        | 导读                          | 说明 FDE 的目标不是逐项展示平台功能，而是把业务问题建设成可运行、可观察、可验收的数字员工闭环。 |
| `crido-scenario-analysis/`             | CRIDO 场景分析                | 使用 `Cue → Reference → Input → Do → Output` 将模糊需求拆解成可开发、可验证的业务场景。 |
| `team-solution-design/`                | Team 内数字员工方案设计       | 规定数字员工设计卡、服务对象、业务职责、不做范围、能力组合和最小验证用例。 |
| `triggers-and-task-orchestration/`     | 触发、任务与计划编排          | 说明如何选择对话、任务看板、计划任务、Calendar Sources、Webhook 和电子邮件等触发方式。 |
| `enterprise-access-and-execution/`     | 企业环境访问与执行能力        | 说明设备、Secret、`browser_use`、WebSkill、`compute_use` 和内网服务的适用场景与组合方式。 |
| `data-knowledge-and-business-objects/` | 数据、知识与业务对象          | 区分结构化业务数据、业务知识和对象关系，帮助判断何时建 Arcubase 表、何时使用知识库。 |
| `vibe-coding-and-workbench/`           | Vibe Coding 与 Workbench 开发 | 介绍 Workbench React 应用的脚手架、Arcubase codegen、本地开发、真实数据接入、构建和发布。 |
| `acceptance-and-maturity/`             | 验收与质量标准                | 规定业务闭环的最小验收单位、各类能力的验收重点和正式交付条件。 |
| `case-patterns/`                       | 场景案例组织方式              | 提供数字员工场景案例的标准写法，包括客户背景、痛点、CRIDO、能力组合、验证和验收。 |
| `reference/`                           | 能力速查                      | 用于快速判断某个需求应查阅计划任务、任务看板、浏览器、Secret、Workbench、知识库或其他能力。 |

## 三、推荐阅读顺序

首次进行小章鱼 FDE 方案设计时，建议按以下顺序阅读：

```text
introduction
→ crido-scenario-analysis
→ team-solution-design
→ triggers-and-task-orchestration
→ enterprise-access-and-execution
→ data-knowledge-and-business-objects
→ vibe-coding-and-workbench
→ acceptance-and-maturity
```

以下两个专题适合按需查阅：

- `case-patterns/`：编写方案案例或参考典型能力组合时使用。
- `reference/`：需要快速定位能力文档时使用。

## 四、专题目录中的文件类型

每个 `guide` 专题通常包含以下文件：

| 文件         | 作用                                            | 是否适合日常阅读   |
| ------------ | ----------------------------------------------- | ------------------ |
| `README.md`  | 专题正文源文件                                  | 是，主要阅读入口   |
| `INDEX.md`   | 文档站发布页面，内容通常与 `README.md` 基本一致 | 一般不需要重复阅读 |
| `SUMMARY.md` | 文档站目录摘要，目前多数只有章节标题            | 否                 |
| `index.json` | 供程序或文档系统使用的结构化索引                | 否                 |

日常查阅时，直接阅读各专题的 `README.md` 即可。

## 五、`skills/` 文件夹

### `workbench-vibe-coding-flow/`

这是用于创建、开发、验证和发布 Syngy Workbench React 应用的可执行 Skill，不是普通介绍文档。

#### `SKILL.md`

规定智能体进行 Workbench 开发时应遵循的完整流程，包括：

1. 核对当前 Octopus Profile、Host、用户和 Team。
2. 确认业务需求、页面路由、数据表和 ingress 映射。
3. 创建 Workbench React 项目。
4. 生成 Arcubase TypeScript SDK。
5. 使用真实 Arcubase 数据实现页面和业务操作。
6. 使用生成 ingress 的 `can()` 能力控制按钮、菜单、表单和字段权限。
7. 验证本地 JCode 登录和真实数据读写。
8. 构建并发布 Workbench 应用。
9. 验证线上路由、登录跳转和页面刷新。

#### `agents/openai.yaml`

这是 Skill 的注册和展示配置，主要包含：

- Skill 的显示名称。
- 简短描述。
- 默认提示词。
- 是否允许系统自动调用该 Skill。

## 六、`OctopusSDK/` 文件夹

`OctopusSDK/` 保存小章鱼官方客户端 SDK。本目录当前包含：

```text
syngy-octopus-client-0.1.5-official-sdk.zip
```

该压缩包对应 npm 包：

```text
@syngy/octopus-client@0.1.5
```

它是面向 Workbench 前端应用的 Octopus Host User API 客户端，用于通过当前 Workbench 登录态调用小章鱼平台能力。

### SDK 的认证方式

SDK 的默认入口 `createOctopusClient()` 会自动使用：

- `@syngy/workbench-auth` 提供的 Host API 地址。
- `createWorkbenchFetch()` 提供的认证请求。
- 当前 Workbench 会话中的用户身份和访问令牌。

因此，Workbench 应用通常不需要手工拼接 Host API Base URL，也不应自行保存用户 Token。

基本调用形式：

```ts
import { createOctopusClient } from '@syngy/octopus-client'

const octopus = createOctopusClient()
const currentUser = await octopus.api.v1MeList()
```

实际方法名和请求参数应以 SDK 中的 TypeScript 类型定义为准。

### SDK 的主要能力范围

| 能力域                 | 示例用途                                                     |
| ---------------------- | ------------------------------------------------------------ |
| 当前用户与 Team        | 获取当前用户、团队列表、团队信息和激活状态                   |
| 成员与组织架构         | 查询成员、搜索成员、部门树、成员部门和组织角色               |
| 数字员工               | 查询、招聘、配置或解雇数字员工，管理 Skill、运行配置和访问范围 |
| 对话                   | 创建对话、发送消息、读取时间线、获取流式事件和上传临时附件   |
| Arcubase               | 查询绑定、获取 App 与表信息、读取记录、访问通用 Arcubase Host 代理 |
| 文件与知识库           | 文件上传、下载、移动、删除、目录查询和知识库同步             |
| 计划任务与日历         | 创建、启用、禁用和运行定时任务，读取运行记录和日历事件       |
| 邮件入口               | 创建、查询、启用或禁用 Team 邮件入口                         |
| 浏览器、设备与计算资源 | 管理浏览器实例、设备、工作空间和计算环境                     |
| 协作平台               | 配置企业微信、微信或飞书等平台的绑定会话                     |
| Artifact 与工作空间    | 查询交付物、下载文件、创建和管理工作空间                     |

### SDK 压缩包内部结构

```text
octopus-client/
├── package.json
└── dist/
    ├── index.js
    ├── index.d.ts
    ├── api.js
    ├── api.d.ts
    ├── api-wrapper.js
    ├── api-wrapper.d.ts
    ├── core.js
    ├── core.d.ts
    ├── unwrap-pin-response.js
    ├── unwrap-pin-response.d.ts
    └── *.map
```

| 文件                         | 作用                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `package.json`               | SDK 包名、版本、依赖、导出入口和构建信息                     |
| `dist/index.*`               | 默认入口，提供自动接入 Workbench 认证的 `createOctopusClient()` |
| `dist/api.*`                 | 自动生成的 Host API 方法和大量请求/响应类型                  |
| `dist/api-wrapper.*`         | 解包平台响应，并统一转换服务端错误                           |
| `dist/core.*`                | 较底层的 API 创建入口，适合需要自行提供请求配置的场景        |
| `dist/unwrap-pin-response.*` | 平台 Pin 响应格式的解包辅助逻辑                              |
| `*.d.ts`                     | TypeScript 类型定义                                          |
| `*.map`                      | JavaScript 和类型声明的 Source Map                           |

### 错误处理

SDK 对平台返回结果进行统一解包，并提供两类主要错误：

- `ApiError`：请求已到达服务端，但平台返回业务或权限错误。
- `ApiUnavailableError`：网络不可用、服务端 5xx 或后端暂时不可达。

应用应分别处理业务错误和服务不可用状态，并向用户展示可理解的失败信息。

### SDK 使用边界

1. `@syngy/octopus-client` 用于访问 Octopus Host API，不替代 Arcubase typed ingress SDK。
2. 业务表的常规数据读写，应优先使用 Arcubase codegen 生成的 typed client。
3. 用户、Team、组织、数字员工、文件、知识库和平台配置等 Host 能力，适合使用 Octopus Client。
4. 压缩包主要包含编译产物和类型定义，不包含完整源码、测试和独立使用手册。
5. 新项目应优先从受信任的软件源安装正式 npm 包；该 ZIP 更适合作为离线备份和类型/API 参考。

## 七、`OctopusTool/` 文件夹

`OctopusTool/` 保存开发、交付和运行过程中使用的辅助工具。本目录当前包含两个压缩包：

```text
OctopusTool/
├── meta-skill-v3.10.1.zip
└── octopus-helper-v0.1.10-windows-amd64.exe.zip
```

### `meta-skill-v3.10.1.zip`

这是 Meta Skill 3.10.1 工具包，用于把复杂、长链、多阶段或涉及副作用恢复的工作流，编译为可重复触发、可验证、可回归的 `SKILL.md` 包。

它适合以下任务：

- 从访谈语料、案例、判据库或现有流程中创建复杂 Skill。
- 重写或加固已有 Skill。
- 为 Skill 建立触发测试、正反案例和回归测试。
- 验证多阶段执行、输出契约和副作用恢复逻辑。
- 比较 Skill 的不同版本，定位能力退化或规则漂移。

它不适合简单的单步骤 Skill；简单 Skill 应使用更轻量的 Skill Creator。

#### Meta Skill 的九阶段流程

1. 锁定目标函数、成功条件、失败条件和运行环境。
2. 将流程拆分为执行段和判断段。
3. 展开每个执行动作、判断标准和断言。
4. 定位或提取权威判据。
5. 通过竞争假说和独立验证补足缺失推理。
6. 编写 `SKILL.md`、执行脚本、契约和审核器。
7. 运行 Skill description 的触发评测。
8. 执行机械检查、黑箱测试和恢复验证。
9. 根据评测结果改进并交付 Skill 包。

#### Meta Skill 包内主要结构

```text
meta-skill/
├── SKILL.md
├── assertions.json
├── runner_binding.json
├── agents/
│   ├── analyzer.md
│   ├── comparator.md
│   └── grader.md
├── references/
├── scripts/
├── fixtures/
├── assets/
└── eval-viewer/
```

| 路径                  | 作用                                                         |
| --------------------- | ------------------------------------------------------------ |
| `SKILL.md`            | Meta Skill 的主执行规范和九阶段编译流程                      |
| `references/`         | 编译规则、契约模型、Schema、验证标准和状态恢复规则           |
| `scripts/`            | 初始化评测空间、运行触发评测、验证、审计、回归和指标聚合脚本 |
| `agents/`             | 独立分析者、比较者和评分者的角色说明                         |
| `assertions.json`     | 机器可执行的 Skill 契约与断言                                |
| `runner_binding.json` | 生产执行入口与验证适配器之间的绑定信息                       |
| `fixtures/`           | Golden、Mutant、负例和自检测试材料                           |
| `assets/`             | 自检输入和评测报告页面模板                                   |
| `eval-viewer/`        | 将评测结果生成静态审阅页面的工具                             |

该 ZIP 中除 macOS 元数据目录外约有 117 个实际文件。`__MACOSX/` 和 `._*` 文件属于 macOS 压缩附带的元数据，安装或复制工具时可以忽略。

### `octopus-helper-v0.1.10-windows-amd64.exe.zip`

这是 Octopus Helper 0.1.10 的 Windows AMD64 构建包。压缩包包含：

```text
octopus-helper-v0.1.10-windows-amd64.exe
```

已确认的技术信息：

- 文件类型：Windows PE32+ 图形化程序。
- CPU 架构：x86-64 / AMD64。
- 运行平台：64 位 Windows。
- 可执行文件大小：约 24.6 MB。
- 本地校验 SHA-256：`3f7e47a22471a99ab06b9a206f3fe5c0f30b8a956396fdd2e60242d4886f3c93`。
- 压缩包通过 ZIP 完整性校验。

根据二进制中可识别的模块名和符号，可以判断它与以下能力有关：

- Octopus 账号登录和授权。
- Team 设备注册与连接状态管理。
- 本地或私有服务的添加、删除与状态同步。
- 通过 Octopus Edge/Gateway 建立连接。
- Windows 系统托盘图形界面。

以上功能范围来自二进制元数据分析。当前压缩包没有附带 README、安装手册或配置说明，因此不能仅凭文件名推断具体部署步骤、网络权限或生产使用方式；正式使用前应取得对应版本的官方操作文档。

#### Octopus Helper 使用注意事项

1. 该程序是 Windows AMD64 版本，不能直接在 macOS 或 Linux 上运行。
2. 不应为了查看功能而在未知或生产环境中直接执行。
3. 正式安装前应核验来源、数字签名或官方发布校验值；上面的 SHA-256 只是当前本地文件的库存校验值，不等同于官方真实性证明。
4. 如果它用于暴露内网或私有服务，应先确认设备归属、Team、服务端口、访问范围、Secret 和停用方式。
5. 压缩包中的 `__MACOSX/` 条目是打包元数据，不是 Windows 程序的一部分。

### 文档、SDK、Skill 与 Tool 的区别

| 类型           | 解决的问题                              | 典型内容                                         |
| -------------- | --------------------------------------- | ------------------------------------------------ |
| `guide/`       | 业务场景应该如何分析和设计              | CRIDO、Team 方案、能力选择、验收标准             |
| `skills/`      | 智能体执行开发任务时应遵循什么流程      | `SKILL.md`、命令、检查项和停止条件               |
| `OctopusSDK/`  | Workbench 代码如何调用 Octopus Host API | npm 包、JavaScript、TypeScript 类型和 API Client |
| `OctopusTool/` | 开发或运行环境需要哪些独立辅助工具      | Skill 编译评测工具、Windows Helper 程序          |

## 八、`guide` 与 `skill` 的区别

| 对比项   | `guide/`                     | `skills/`                        |
| -------- | ---------------------------- | -------------------------------- |
| 主要读者 | FDE、方案人员、开发者        | Codex 等开发智能体               |
| 主要目标 | 解释业务场景如何分析和设计   | 规定开发任务如何实际执行         |
| 内容形式 | 方法论、原则、案例、验收标准 | 命令、检查项、停止条件、验证流程 |
| 使用方式 | 人工阅读和方案设计参考       | 在符合触发条件的开发任务中执行   |

简单来说：

- `guide` 解释“为什么做、什么时候做”。
- `skill` 规定“具体怎么做、如何验证”。

## 九、使用时的注意事项

1. Workbench 开发必须连接真实 Arcubase 数据，不能用 mock 数据代替业务闭环。
2. 可见业务按钮必须有真实行为，否则应禁用或移除。
3. Arcubase 的 ingress 和 field key 应保持稳定，表结构变化后应重新生成 SDK。
4. 浏览器端应通过 Workbench Host/JCode 认证访问平台能力，不能暴露 Arcubase 管理员 Token。
5. 资料中的命令可能对应不同版本；当文档和当前安装版本不一致时，以当前 CLI 的 `--help` 输出为准。
6. `workbench-vibe-coding-flow/SKILL.md` 中的 codegen 示例使用了 `--web-url` 参数；不同版本的 codegen CLI 可能改用 `--team-id`，执行前必须查看当前版本的 `--help`。
7. 企业环境章节存在其他开发环境遗留的本地绝对路径，不应将其当作通用配置。
