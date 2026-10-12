---
title: Vibe Coding 与 Workbench 应用开发
order: 7
---
# Vibe Coding 与 Workbench 应用开发

Vibe Coding 用于创建、运行和发布应用或代码型产物。

在 FDE 场景开发中，Vibe Coding 适合把结构化业务对象做成 team 内可使用的 Workbench 应用，让用户通过列表、筛选、表单和操作按钮完成日常工作。

## 一条推荐路径

Workbench Vibe Coding 的推荐路径是：

```bash
octopus-cli coding
npm create @syngy/workbench-app-react@latest <app> -- --features arcubase
npm run arcubase:codegen
npm run dev
npm run build
octopus-cli coding projects publish <project-id> --path dist --json
```

## 公开 npm packages

Workbench 应用开发常用 npm packages 包括：

| 包 | 作用 |
| --- | --- |
| `@syngy/create-workbench-app-react` | 创建 Workbench React app |
| `@syngy/workbench-auth` | Workbench 运行时会话、token refresh 和 Host 请求认证 |
| `@syngy/workbench-devtools` | 本地开发登录页和 JCode handoff |
| `@syngy/workbench-arcubase-codegen` | 从 Arcubase ingress 和 entity schema 生成 TypeScript SDK |
| `@syngy/arcubase-client` | app 侧 Arcubase client |

## FDE 何时使用 Vibe Coding

适合使用 Vibe Coding 的场景：

- 客户需要一个 team 内可用的业务工作台。
- 仅靠聊天和任务看板无法高效完成结构化操作。
- 需要可视化列表、筛选、表单、编辑、同步或发布入口。
- Arcubase 已经能提供业务数据结构和 ingress。

不适合使用 Vibe Coding 的场景：

- 需求还没有明确业务对象和工作流。
- 只是一次性报告或一次性页面。
- 没有明确数据接入路径。
- 业务系统已有成熟页面且只需要通过 browser_use 低频操作。

## 最小验证

一个 Workbench app 至少要验证：

- 本地能启动。
- 未登录时能进入开发登录流程。
- 页面能显示当前用户。
- 业务页面通过生成的 Arcubase SDK 读取真实记录或真实空状态。
- 创建或更新入口调用生成 SDK，而不是只改本地 mock 数据。
- 构建产物能发布到 Workbench。

## octopus-cli

octopus-cli 是命令行工具。

在 Vibe Coding 中，octopus-cli 主要用于：

- 查看当前登录和 team。
- 列出可用模板。
- 创建 coding project。
- 发布构建产物。
- 观察发布任务状态。

交付记录应包含实际命令、输出摘要、项目 ID、发布结果和验证页面。

## 目录

