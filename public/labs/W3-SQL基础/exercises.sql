.headers on
.mode column

-- 任务 1：先看样本。运行后在 notes.md 写出“一行代表什么”和可能的唯一键。
SELECT * FROM orders LIMIT 10;

-- 每次重跑练习都先删除旧视图，避免旧答案干扰本次结果。
DROP VIEW IF EXISTS w3_target_orders;
DROP VIEW IF EXISTS w3_target_summary;
DROP VIEW IF EXISTS w3_anomalies;
DROP VIEW IF EXISTS w3_channel_summary;

-- 任务 2–5：补全条件，查询 2026-08-31 当天、已支付、非测试、使用新人券的订单。
-- 保留视图名 w3_target_orders，自检会读取它。
CREATE VIEW w3_target_orders AS
SELECT order_id, user_id, paid_amount, paid_at
FROM orders
WHERE 1 = 1
  -- TODO：补上时间左边界、时间右边界、支付状态、测试订单和优惠券类型。
;

SELECT * FROM w3_target_orders ORDER BY paid_at DESC;

-- 任务 6–9：补全聚合，对账行数、唯一订单、唯一用户和金额。
-- 金额先按原始结果行求和，随后用 row_count 与 unique_orders 暴露重复风险。
CREATE VIEW w3_target_summary AS
SELECT
  COUNT(*) AS row_count,
  0 AS unique_orders,       -- TODO：替换 0
  0 AS unique_users,        -- TODO：替换 0
  0.0 AS raw_paid_amount    -- TODO：替换 0.0；空金额按 0 处理
FROM w3_target_orders;

SELECT * FROM w3_target_summary;

-- 任务 10：找出用户为空、金额为空、金额非正数或订单重复的记录。
-- duplicate_count 表示同一个 order_id 在原表出现了几次。
CREATE VIEW w3_anomalies AS
SELECT row_id, order_id, user_id, paid_amount, 0 AS duplicate_count
FROM orders
WHERE 0; -- TODO：改成能够找出四类异常的查询。

SELECT * FROM w3_anomalies ORDER BY row_id;

-- 任务 11：按 channel 分组，输出支付订单数、去重用户数和金额。
-- 先把重复 order_id 压到订单粒度，再按渠道聚合；范围是当天全部非测试 paid 订单。
CREATE VIEW w3_channel_summary AS
SELECT channel, 0 AS paid_orders, 0 AS paid_users, 0.0 AS paid_amount
FROM orders
WHERE 0 -- TODO：替换为空间正确的去重与分组查询。
GROUP BY channel;

SELECT * FROM w3_channel_summary ORDER BY paid_amount DESC;

-- 任务 12：不要写 SQL。请完成 notes.md 的全部字段。
