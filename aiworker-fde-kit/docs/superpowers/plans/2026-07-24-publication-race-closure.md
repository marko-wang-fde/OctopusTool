# Publication Race Closure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 闭合 resume 成功返回前的 manifest 竞态窗口，并让 initialize 以内核原子 no-overwrite 方式声明最终目录。

**Architecture:** resume 使用统一的最终稳定性检查：有 manifest 时执行 `lock → nofollow inode+bytes → lock`，无 manifest 时执行 `lock → manifest → lock → manifest`。initialize 先在内存中准备并校验发布计划，再创建外部 transaction marker，使用非递归 `mkdir(finalTarget)` 原子声明目标，并以独占文件创建装配；初始化期间目录可见性采用 cooperative transaction 语义，读者看到 marker 必须 retry。

**Tech Stack:** Node.js 20 ESM、`node:fs/promises`、Vitest。

---

### Task 1: 闭合无 manifest proposal 的末尾窗口

**Files:**

- Modify: `src/project/resume.js`
- Test: `test/integration/init-project.test.js`

- [x] 增加在第二次 lock 检查后注入 manifest 的失败测试。
- [x] 运行定向测试并确认旧实现错误返回 proposal。
- [x] 实现 `lock → manifest → lock → manifest` 复核。
- [x] 运行定向测试确认返回 `B_PROJECT_TRANSACTION_LOCKED`。

### Task 2: 成功返回前最终校验 manifest snapshot

**Files:**

- Modify: `src/project/resume.js`
- Test: `test/integration/init-project.test.js`

- [x] 增加 normal resume 在 schema validation 后替换 manifest 的失败测试。
- [x] 增加 normal resume 在 stage hash inspection 中替换 manifest 的失败测试。
- [x] 增加 migration preview validation 后替换 manifest 的失败测试。
- [x] 运行定向测试并确认旧实现消费旧 snapshot。
- [x] 提取 `lock → nofollow inode+bytes → lock` 最终校验并放在每个成功返回之前。
- [x] 运行所有 resume 集成测试确认历史竞态保持通过。

### Task 3: initialize 原子声明和 cooperative transaction 装配

**Files:**

- Modify: `src/project/project-runtime.js`
- Modify: `src/project/initialize.js`
- Modify: `src/project/resume.js`
- Test: `test/integration/init-project.test.js`

- [x] 增加 concurrent `mkdir(finalTarget)` 的 inode/content no-overwrite 测试。
- [x] 增加旧 rename 边界目标 inode 被替换的 reviewer 注入测试。
- [x] 增加装配失败保留并报告 partial target 与 marker 的测试。
- [x] 运行定向测试并确认旧 rename 会覆盖空目录。
- [x] 将模板和来源转换为内存发布计划，发布文件均使用 `O_EXCL|O_NOFOLLOW`。
- [x] 在创建 final target 前创建外部 marker；使用 `mkdir(..., {recursive:false})` 原子声明 target。
- [x] 逐级独占创建目录/文件，成功后验证精确 inventory 并移除 marker。
- [x] 失败时不清理 final target，仅报告 partial target 与 marker；已有 target 的 EEXIST 路径不触碰。
- [x] 将 reader 的 marker 检查移动到 project directory 读取之前。
- [x] 运行完整 initialize/resume 集成测试。

### Task 4: 验证和提交

**Files:**

- Modify: only files listed above.

- [x] 运行 `npm run verify`，确认所有测试和 lint 通过。
- [x] 运行 `git diff --check` 并审查完整 diff。
- [x] 确认工作树仅包含本计划范围。
- [ ] 创建独立提交并报告完整 SHA。

### Task 5: Harden directory ancestry and committed cleanup

**Files:**

- Modify: `src/project/initialize.js`
- Modify: `test/integration/init-project.test.js`
- Create: `references/transaction-contract.md`
- Modify: `SKILL.md`

- [x] 增加 inventory scan/read 前将 `inputs` 替换为外部 symlink 的失败测试。
- [x] 增加 ancestor identity 检查后、leaf open 前替换父目录的失败测试。
- [x] 运行定向测试，确认旧实现会遍历或写入外部目录。
- [x] 让装配返回 root 与所有子目录 identity，并在 leaf 写入前后校验完整 ancestor chain。
- [x] 最终 inventory/content 校验逐目录复核 identity，并通过 ancestor-aware nofollow helper 读取 leaf。
- [x] 增加 committed 后 marker `rmdir` EIO 的失败测试。
- [x] 完整 inventory/content 验证后设置 committed；marker 清理失败返回 initialized success warning。
- [x] 在 `references/transaction-contract.md` 记录 portable Node cooperative transaction 保证与明确非保证。
- [ ] 运行 `npm run verify`、lint、`git diff --check`，审查完整 diff并独立提交。

### Task 6: Bind stage acceptance to the validation snapshot

**Files:**

- Modify: `src/contracts/project-validator.js`
- Modify: `src/project/stage-state.js`
- Modify: `src/commands/validate-project.js`
- Modify: `src/project/validation-report.js`
- Test: `test/integration/validate-project.test.js`

- [x] 增加 validation 返回后追加 manifest 内容的失败测试。
- [x] 增加 validation 返回后修改当前 stage authoritative artifact 的失败测试。
- [x] 运行定向测试，确认旧实现仍会提交旧 acceptance。
- [x] 让 validation context 返回 manifest 与当前所有 stage authoritative files 的 exact bytes/hash/type/dev/ino/mode snapshot。
- [x] 把 acceptance 使用的 snapshot 传入 report transaction，并在任何 publish 前 under lock 逐项 nofollow/ancestor 复核。
- [x] 漂移时 fail closed，保留用户编辑并返回结构化 recovery。

### Task 7: Enforce bidirectional Skill ownership and package completeness

**Files:**

- Modify: `src/contracts/cross-references.js`
- Test: `test/unit/contracts/cross-references.test.js`

- [x] 增加 orphan owner、owner 反向缺失、冲突 owner、Skill package 缺失/重复/unsafe 测试。
- [x] 运行定向测试确认稳定 BLOCKER 尚未产生。
- [x] 以 `project.skills` 为权威全集反向验证 owner 与 worker.skills。
- [x] 为每个 project Skill 解析唯一 package path；explicit override 只替换对应 Skill，不能缩小全集。

### Task 8: Bind validation report transaction ancestors

**Files:**

- Modify: `src/project/project-runtime.js`
- Modify: `src/project/initialize.js`
- Modify: `src/project/validation-report.js`
- Modify: `references/transaction-contract.md`
- Test: `test/integration/validate-project.test.js`

- [x] 增加 reports 检查后替换为 symlink 的失败测试并断言外部目录无写入。
- [x] 运行定向测试确认旧实现可写出项目边界。
- [x] 从 initialize 提取共享 ancestor identity snapshot/assert helpers。
- [x] report transaction 在 temp/open/link/rename/read 前后复核 root、reports 与相关 ancestor chain。
- [x] 保持公开 cooperative transaction contract，不宣称阻止同 UID 主动攻击。

### Task 9: Verify and commit

**Files:**

- Modify: only files listed above.

- [x] 运行所有新增定向测试。
- [x] 运行 `npm run verify`。
- [x] 运行 `git diff --check` 并审查完整 diff。
- [ ] 创建独立提交并报告 SHA。

### Task 10: Close the pre-publish acceptance snapshot window

**Files:**

- Modify: `src/contracts/project-validator.js`
- Modify: `src/project/validation-report.js`
- Modify: `references/transaction-contract.md`
- Test: `test/integration/validate-project.test.js`

- [x] 增加首个 report temp 创建期间修改 manifest 的失败测试。
- [x] 增加 temp 准备期间新增 author-stage glob member 的失败测试。
- [x] 运行定向测试确认旧实现仍会 publish stale acceptance。
- [x] validation snapshot 保存 authoritative patterns 与 canonical sorted resolved path set。
- [x] transaction 在全部 bytes/temp 准备完成后、任何 target publish 前重新解析当前 membership 并 exact compare。
- [x] 最终 gate 同时复核所有 validation-time file snapshots；drift 返回 `E_VALIDATION_SNAPSHOT_DRIFT`。
- [ ] 更新 cooperative transaction 文档，运行 full verify/lint/diff 并独立提交。
