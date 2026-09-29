# 身份与访问

- 数字员工服务账号：读、创建、更新；不得删除。
- `role.sales`：通过数字员工按 `field.submitter_arcubase_user_id = current-speaker.id` 查询本人记录。
- `role.sales_manager`：只读查询全部。
- `role.intern`：仅为拒绝测试身份，不是待创建的组织角色。

所有操作先读取 Current Speaker，权限拒绝发生在业务表查询之前。
