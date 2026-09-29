# 验收计划

固定语言 `zh-CN`、时区 `Asia/Shanghai`、时钟 `2026-07-24T01:00:00Z`。

执行九个用例：完整登记、缺少联系方式、疑似重复、摘要取消、未授权全量查询、销售本人查询、经理查询、静态一致性、装配预演。

固定身份：

- 销售张楠：`user.fixture.sales.zhang_nan`
- 销售经理陈晨：`user.fixture.manager.chen_chen`
- 对抗身份：`user.fixture.intern` / `role.intern`

预置重复记录：

- `company_name`: 杭州清禾食品有限公司
- `contact_name`: 李明
- `contact_method`: `138 0000 0001`
- `requirement_summary`: 希望了解样品和经销政策
- `source`: `3`
- `submitter_arcubase_user_id`: `user.fixture.sales.zhang_nan`
- `submitter_name`: 张楠
- `status`: `1`
- `created_at`: `1784854800`

电话比较值删除 ASCII/Unicode 空白、`-`、`(`、`)`，因此 `138 0000 0001` 与 `138-0000-0001` 相同。
