---
name: collect-sales-leads
description: Use when an authenticated internal sales user needs to register or query customer leads through the AIWorker conversation.
---

# Collect Sales Leads

1. 从 Current Speaker 获取用户 ID 与组织角色。
2. 提取 `field.company_name`、`field.contact_name`、`field.contact_method`、`field.requirement_summary` 和 `field.source`。
3. 只追问缺失的关键字段。
4. 查询规范化公司名和联系方式相同且 `field.status != 4` 的疑似重复记录。
5. 展示全部九字段摘要；用户明确确认后才可创建。
6. 写入 `field.submitter_arcubase_user_id`、`field.submitter_name`、`field.status=1` 和 `field.created_at`。
7. 返回记录 ID 和登记结果。

销售查询必须限定 Current Speaker ID；销售经理只读查询全部。拒绝 `role.intern` 的全量查询。不得删除、外发或自动分配。

规范化使用 Unicode NFKC。公司名去首尾空白，将连续 Unicode 空白折叠为一个 ASCII 空格后做 locale-independent lowercase；电话比较值删除 ASCII/Unicode 空白、`-`、`(`、`)`。疑似重复只展示已有摘要，未经再次确认不得新增。
