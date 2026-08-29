.headers on
.mode column

DROP VIEW IF EXISTS w3_target_orders;
DROP VIEW IF EXISTS w3_target_summary;
DROP VIEW IF EXISTS w3_anomalies;
DROP VIEW IF EXISTS w3_channel_summary;

-- A1–A5：目标订单明细。
CREATE VIEW w3_target_orders AS
SELECT order_id, user_id, paid_amount, paid_at
FROM orders
WHERE status = 'paid'
  AND is_test = 0
  AND coupon_type = 'new_user'
  AND paid_at >= '2026-08-31 00:00:00'
  AND paid_at <  '2026-09-01 00:00:00';

SELECT * FROM w3_target_orders ORDER BY paid_at DESC;

-- A6–A9：重复行会让 row_count 大于 unique_orders。
CREATE VIEW w3_target_summary AS
SELECT
  COUNT(*) AS row_count,
  COUNT(DISTINCT order_id) AS unique_orders,
  COUNT(DISTINCT user_id) AS unique_users,
  ROUND(SUM(COALESCE(paid_amount, 0)), 2) AS raw_paid_amount
FROM w3_target_orders;

SELECT * FROM w3_target_summary;

-- A10：异常记录。窗口函数用于识别重复 order_id。
CREATE VIEW w3_anomalies AS
WITH checked AS (
  SELECT *, COUNT(*) OVER (PARTITION BY order_id) AS duplicate_count
  FROM orders
)
SELECT row_id, order_id, user_id, paid_amount, duplicate_count
FROM checked
WHERE user_id IS NULL
   OR paid_amount IS NULL
   OR paid_amount <= 0
   OR duplicate_count > 1;

SELECT * FROM w3_anomalies ORDER BY row_id;

-- A11：先用 DISTINCT 订单消除教学数据中的重复行。
CREATE VIEW w3_channel_summary AS
WITH paid_orders AS (
  SELECT DISTINCT order_id, user_id, channel, paid_amount
  FROM orders
  WHERE status = 'paid'
    AND is_test = 0
    AND paid_at >= '2026-08-31 00:00:00'
    AND paid_at <  '2026-09-01 00:00:00'
)
SELECT
  channel,
  COUNT(*) AS paid_orders,
  COUNT(DISTINCT user_id) AS paid_users,
  ROUND(SUM(COALESCE(paid_amount, 0)), 2) AS paid_amount
FROM paid_orders
GROUP BY channel;

SELECT * FROM w3_channel_summary ORDER BY paid_amount DESC;
