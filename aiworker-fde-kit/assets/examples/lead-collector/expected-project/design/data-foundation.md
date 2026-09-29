# 数据地基

采用专属 Arcubase 应用 `app.lead_collection` 和表 `table.sales_leads`。

表包含九个字段：公司、联系人、联系方式、需求摘要、来源、提交人 ID、提交人姓名快照、状态、创建时间。

契约字段标识 `field.company_name` 至 `field.created_at` 分别绑定平台字段 ID `1001` 至 `1009`。

公司名采用 Unicode NFKC、首尾去空白、连续 Unicode 空白折叠为 ASCII 空格、locale-independent lowercase。电话比较值删除空白、`-`、`(`、`)`。
