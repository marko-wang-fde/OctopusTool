---
title: Reference：能力速查
order: 11
---
# Reference：能力速查

本章用于快速定位 FDE 场景开发中常见能力的使用位置。能力选择应以业务闭环为准，不应为了展示能力而扩大授权范围。

| 能力 | 适用位置 |
| --- | --- |
| 计划任务：按时间、日历或周期触发任务 | [触发、任务与计划编排](../triggers-and-task-orchestration/README.md) |
| 任务看板：围绕任务分配、状态和活动进行协作 | [触发、任务与计划编排](../triggers-and-task-orchestration/README.md) |
| 设备：管理可供系统使用的团队设备 | [企业环境访问与执行能力](../enterprise-access-and-execution/README.md) |
| 保险箱 / Secret：管理系统使用所需的凭据和秘密 | [企业环境访问与执行能力](../enterprise-access-and-execution/README.md) |
| Vibe Coding：创建、运行和发布应用或代码型产物 | [Vibe Coding 与 Workbench 应用开发](../vibe-coding-and-workbench/README.md) |
| 浏览器能力：通过浏览器访问和操作网页系统 | [企业环境访问与执行能力](../enterprise-access-and-execution/README.md) |
| WebSkill 管理：沉淀和管理可复用网页操作流程 | [企业环境访问与执行能力](../enterprise-access-and-execution/README.md) |
| Webhook：通过外部事件触发系统能力 | [触发、任务与计划编排](../triggers-and-task-orchestration/README.md) |
| 电子邮箱：通过邮件入口接收、处理和输出信息 | [触发、任务与计划编排](../triggers-and-task-orchestration/README.md) |
| 知识库同步：同步和使用团队知识资料 | [数据、知识与业务对象](../data-knowledge-and-business-objects/README.md) |
| 算力与账单：查看和管理计算资源使用情况 | 资源规划和交付前评估 |
| 内网服务：访问用户内网或私有服务 | [企业环境访问与执行能力](../enterprise-access-and-execution/README.md) |
| octopus-cli 命令行工具 | [Vibe Coding 与 Workbench 应用开发](../vibe-coding-and-workbench/README.md) |

## 选择原则

- 先判断业务闭环，再选择能力。
- 对客户系统有写入或提交动作时，必须明确触发人、执行员工、结果落点和失败处理。
- 需要网页登录、账号或私有服务时，优先设计 Secret、设备、browser_use 和内网服务的组合。
- 高频网页流程优先沉淀为 WebSkill。
- 结构化业务操作优先使用数据表或 Workbench 应用承接。

## 目录

