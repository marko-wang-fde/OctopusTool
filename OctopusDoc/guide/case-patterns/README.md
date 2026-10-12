---
title: 场景案例组织方式
order: 10
---
# 场景案例组织方式

案例章节不应写成产品能力堆叠，而应写成业务闭环如何被数字员工 team 承接。

## 案例结构

每个案例建议使用以下结构：

1. 客户背景。
2. 业务痛点。
3. CRIDO 分析。
4. team 内员工设计。
5. 能力组合。
6. 数据和知识准备。
7. 最小验证用例。
8. 验收结果和后续优化项。

## 示例：每日经营简报

业务目标：老板每天早上看到销售、订单、回款和异常事项摘要。

CRIDO：

| 环节 | 内容 |
| --- | --- |
| Cue | 计划任务，工作日早上触发；Calendar Sources 用于判断工作日 |
| Reference | 简报 skill、指标口径文档 |
| Input | 客户、订单、回款、任务异常记录 |
| Do | 查询业务数据，生成摘要，必要时创建任务 |
| Output | 简报消息和异常任务 |

能力组合：

- 计划任务。
- Calendar Sources。
- 任务看板。
- 数据表或业务数据源。
- 外部消息或对话结果。

## 示例：网页后台订单巡检

业务目标：员工每天进入供应商或电商后台，下载订单报表并标记异常。

CRIDO：

| 环节 | 内容 |
| --- | --- |
| Cue | 计划任务或用户对话 |
| Reference | 巡检 skill、后台页面操作说明、WebSkill |
| Input | 后台账号 Secret、目标日期、订单规则 |
| Do | browser_use 打开后台，必要时使用设备或内网服务 |
| Output | 异常清单、任务或数据更新 |

能力组合：

- browser_use。
- WebSkill。
- Secret。
- 设备。
- 计划任务。
- 任务看板。

## 示例：Workbench 业务应用

业务目标：为 team 创建一个可视化业务工作台，用于查看客户、商机或订单。

CRIDO：

| 环节 | 内容 |
| --- | --- |
| Cue | 用户进入 Workbench 应用 |
| Reference | 应用需求说明、Arcubase schema、生成 SDK |
| Input | 当前用户、Arcubase records |
| Do | Vibe Coding、octopus-cli、npm packages、Arcubase codegen |
| Output | 已发布的 Workbench 应用 |

能力组合：

- Vibe Coding。
- octopus-cli。
- Arcubase。
- Workbench npm packages。
