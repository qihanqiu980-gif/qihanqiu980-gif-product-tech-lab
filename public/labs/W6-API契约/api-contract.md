# 会员标签 API 契约（教学模拟）

## 创建标签

- Method：`POST`
- Path：`/api/v1/member-tags`
- Auth：测试环境 Bearer Token
- Content-Type：`application/json`
- 幂等：调用方传 `Idempotency-Key`，同一个 Key 返回同一标签

| 字段 | 类型 | 必填 | 边界 | null | 空字符串 |
|---|---|---|---|---|---|
| name | string | 是 | 去首尾空格后 1–30 字符，同租户不可重名 | 不允许 | 不允许 |
| color | enum | 是 | orange / blue / green / gray | 不允许 | 不允许 |
| description | string | 否 | 最长 200 字符 | 表示清空 | 不允许 |

成功：`201`，返回 `tag_id`、规范化后的字段和 `request_id`。

失败：

- `400 INVALID_ARGUMENT`：类型、长度、枚举或未知字段错误。
- `401 UNAUTHENTICATED`：未登录或 Token 无效。
- `403 PERMISSION_DENIED`：已登录但无创建权限。
- `409 NAME_CONFLICT`：同租户名称重复。
- `429 RATE_LIMITED`：限流，返回 `Retry-After`。
- `500 INTERNAL_ERROR`：未知错误，用户可稍后重试并提供 request_id。

## 兼容性检查

- 客户端忽略未知响应字段。
- 枚举新增前确认旧客户端是否有 default 分支。
- 字段废弃先标记，再经过至少一个兼容周期移除。
