.headers on
.mode column

DROP VIEW IF EXISTS w4_paid_within_24h;
DROP VIEW IF EXISTS w4_funnel_metrics;
DROP VIEW IF EXISTS w4_unique_paid_orders;
DROP VIEW IF EXISTS w4_paid_amount_summary;
DROP VIEW IF EXISTS w4_median_nearby;

-- A1：每位用户从自己的结算时刻开始计算滚动 24 小时。
-- U03 的结算时间为 09-07 10:01，支付时间为 09-08 11:00，相差 24 小时 59 分钟，因此不计入。
CREATE VIEW w4_paid_within_24h AS
WITH checkouts AS (
  SELECT user_id, event_time AS checkout_time
  FROM events
  WHERE event_name='checkout_view' AND is_test=0
), payments AS (
  SELECT user_id, event_time AS payment_time
  FROM events
  WHERE event_name='payment_success' AND is_test=0
)
SELECT DISTINCT c.user_id
FROM checkouts c
JOIN payments p ON p.user_id=c.user_id
WHERE p.payment_time >= c.checkout_time
  AND p.payment_time < datetime(c.checkout_time, '+24 hours');

-- A2–A3：自然日口径与滚动 24 小时口径并列展示。
CREATE VIEW w4_funnel_metrics AS
WITH counts AS (
  SELECT
    COUNT(DISTINCT CASE WHEN event_name='coupon_exposure' AND is_test=0 THEN user_id END) AS exposed_users,
    COUNT(DISTINCT CASE WHEN event_name='checkout_view' AND is_test=0 THEN user_id END) AS checkout_users,
    COUNT(DISTINCT CASE
      WHEN event_name='payment_success' AND is_test=0
       AND event_time >= '2026-09-07 00:00:00'
       AND event_time <  '2026-09-08 00:00:00'
      THEN user_id END) AS paid_same_day_users,
    (SELECT COUNT(*) FROM w4_paid_within_24h) AS paid_within_24h_users
  FROM events
)
SELECT
  exposed_users,
  checkout_users,
  paid_same_day_users,
  paid_within_24h_users,
  ROUND(1.0 * paid_same_day_users / exposed_users, 4) AS exposure_to_pay,
  ROUND(1.0 * paid_same_day_users / checkout_users, 4) AS checkout_to_pay,
  ROUND(1.0 * paid_within_24h_users / checkout_users, 4) AS checkout_to_pay_24h
FROM counts;

SELECT * FROM w4_funnel_metrics;

-- A4：按 order_id 去重；MAX(amount) 用于吸收同一订单的重复成功事件。
CREATE VIEW w4_unique_paid_orders AS
SELECT order_id, MAX(amount) AS amount
FROM events
WHERE event_name='payment_success' AND is_test=0
GROUP BY order_id;

-- A5：SQLite 没有内置 MEDIAN，先排序编号，再取中间位次的平均值。
CREATE VIEW w4_paid_amount_summary AS
WITH ranked AS (
  SELECT
    order_id,
    amount,
    ROW_NUMBER() OVER (ORDER BY amount, order_id) AS amount_rank,
    COUNT(*) OVER () AS item_count
  FROM w4_unique_paid_orders
)
SELECT
  COUNT(*) AS unique_paid_orders,
  ROUND(AVG(amount), 2) AS average_amount,
  ROUND((SELECT AVG(amount)
         FROM ranked
         WHERE amount_rank IN ((item_count + 1) / 2, (item_count + 2) / 2)), 2) AS median_amount,
  MIN(amount) AS min_amount,
  MAX(amount) AS max_amount
FROM w4_unique_paid_orders;

SELECT * FROM w4_paid_amount_summary;

-- A6：中位数 89 附近的三条原始订单样本，便于看见 59、89、199 的位置关系。
CREATE VIEW w4_median_nearby AS
WITH ranked AS (
  SELECT
    order_id,
    amount,
    ROW_NUMBER() OVER (ORDER BY amount, order_id) AS amount_rank,
    COUNT(*) OVER () AS item_count
  FROM w4_unique_paid_orders
)
SELECT order_id, amount, amount_rank
FROM ranked
WHERE amount_rank BETWEEN ((item_count + 1) / 2) - 1
                      AND ((item_count + 1) / 2) + 1;

SELECT * FROM w4_median_nearby ORDER BY amount_rank;

-- 额外展示：异常大单 U06/O06 会把平均值推到 2077，而中位数仍为 89。
SELECT order_id, amount
FROM w4_unique_paid_orders
ORDER BY amount DESC;
