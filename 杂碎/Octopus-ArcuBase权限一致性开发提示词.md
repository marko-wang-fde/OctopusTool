# Octopus / Workbench / ArcuBase 权限一致性开发提示词

## 使用方法

在下一次开发 Octopus Workbench 应用时，将下面的提示词放在需求说明之前，要求开发人员或 AI 编程助手全程遵守。

## 可直接复制的提示词

```text
请严格按照 Octopus、Workbench 和 ArcuBase 开发规范完成本项目，重点防止 Host 团队成员身份与 ArcuBase 用户身份不一致造成 Permission not allowed。

权限设计与开发要求：

1. 开发前先核验当前登录环境：
   - Octopus CLI 登录账号
   - API Host
   - Team ID
   - Workbench 项目 ID
   - ArcuBase App ID
   禁止在团队、账号或应用不一致时继续修改或发布。

2. 明确区分以下身份，不得混用：
   - Workbench/Host userId
   - 团队成员 ID
   - ArcuBase userId
   - 数字员工 ID
   - 业务角色 ID

3. 所有写入 ArcuBase member 类型字段的值，必须使用当前团队成员实际绑定的 ArcuBase userId，并按字段要求使用数字类型；禁止直接写入 Host userId、手机号、姓名或字符串形式的错误 ID。

4. 应用初始化时，必须通过团队成员绑定关系完成：
   Workbench viewer.id → Team Member → ArcuBase userId
   不允许假设两个系统中的用户 ID 相同。

5. 在开发数据访问规则之前，检查当前团队所有成员：
   - 是否存在重复成员
   - 是否存在已删除成员残留
   - 是否存在同一人员对应多个 ArcuBase 身份
   - Host 成员绑定的 ArcuBase userId 是否与 ArcuBase 当前登录身份一致
   发现异常时先修复身份绑定，不要通过硬编码 ID 绕过。

6. 业务权限使用 ArcuBase 数据访问规则实现。平台管理员沿用 Octopus 团队管理员身份，不另外建设“管理员”业务角色。

7. 如果平台管理员需要执行完整业务流程：
   - 在 Octopus 中给他分配所需业务角色；
   - 应用必须读取并识别平台管理员状态；
   - 仅平台管理员可以选择“平台管理员例外”数据入口；
   - 普通用户必须继续使用其业务角色对应的入口；
   - 禁止通过规则名称排序、规则数量或硬编码人员姓名决定入口。

8. 每个页面和操作必须按“表 + 动作”选择数据入口：
   - view：查询
   - add：新建
   - edit：修改或审批
   - delete：删除
   前端显示页面权限不能代替 ArcuBase 数据权限。

9. 新建记录前必须同时检查：
   - 当前用户是否具有对应业务角色
   - 所选入口是否包含 add
   - 写入字段是否在入口白名单内
   - member 字段是否为有效的数字型 ArcuBase userId
   - 条件字段（部门负责人、提交人等）是否与数据规则一致

10. 权限规则新增或修改后，必须重新生成 ArcuBase SDK，再构建和发布 Workbench。禁止继续使用旧 schema、旧 ingress hash 或旧构建产物。

11. 发布前做最小权限冒烟验证：
   - 普通人事专员可以新建用人需求
   - 部门领导只能操作本部门数据
   - 人事经理可以审批
   - Offer 专员可以执行 Offer 操作
   - Octopus 团队管理员在拥有相应业务角色时可以跑完整流程
   - 无权限用户的操作应被拒绝
   - 刷新页面后权限仍然正确

12. 如果出现 Permission not allowed，不要只增加一条宽泛规则。必须依次输出并核对：
   - 当前 viewer.id
   - 当前团队成员 ID
   - 当前绑定的 ArcuBase userId
   - ArcuBase /user-profile 返回的用户 ID
   - 当前业务角色
   - 是否为团队管理员
   - 实际选择的 ingress 名称、ID/hash 和 actions
   - 提交字段及字段类型
   找出身份、入口、动作、字段或条件中具体不一致的一项后再修复。

13. 禁止将人员姓名、手机号或某个固定 userId 硬编码进业务代码。人员变化只能通过团队成员绑定、角色配置和数据访问规则处理。

完成后，请给我一份权限审计结果，列出：
- 身份映射
- 角色与人员
- 表与动作对应的数据入口
- 管理员处理方式
- 发现和修复的问题
- 构建及发布结果
- 冒烟验证结果
```

## 必须放在任务开头的核心约束

> 所有涉及用户身份和 member 字段的功能，必须先验证 `Workbench viewer.id → 团队成员 → ArcuBase userId → /user-profile` 四者的映射，不得假设 Host userId 与 ArcuBase userId 相同。

## 建议的验收证据

开发交付时至少保留以下信息，便于复查和排障：

- 当前 CLI 账号、Host 和 Team ID
- Workbench 项目 ID 与 ArcuBase App ID
- 测试人员的 Host userId 与 ArcuBase userId 映射
- 业务角色及平台管理员状态
- 每项操作实际命中的 ingress 名称、规则 ID/hash 和 actions
- member 字段的值及数据类型
- SDK 生成、构建、发布和冒烟验证结果

