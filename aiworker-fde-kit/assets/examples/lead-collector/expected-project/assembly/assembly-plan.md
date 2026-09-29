# 装配计划

## 人工操作

1. `skill-package.upload`：上传普通 Skill 包。
2. `arcubase-app.create`：新建专属 Arcubase 应用。
3. `arcubase-table.create`：创建九字段表并应用权限。
4. `skill-set.create`：当前 `octopus-cli` 0.1.2 的 `configure skill set add` 存在 `--body-file` 未正确传递的 live bug，需管理员手工创建技能集并记录证据。

以上均为 `manual-required`，不得生成虚构 Payload。

## octopus-cli live assembly

在用户确认 Profile、Team 和交付包 hash 后，仅直接装配 `team-private-digiworker.create`。脚本通过固定 `run_octopus_assemble` 封装函数调用，不包含 `--dryrun`。`team-private-digiworker.create` 会同时创建私有 Worker 和 Team Employee，因此本方案不再追加 `employee-hire.create`。
