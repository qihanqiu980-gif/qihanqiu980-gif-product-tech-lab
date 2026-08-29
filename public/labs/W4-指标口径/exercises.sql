.headers on
.mode column

DROP VIEW IF EXISTS w4_paid_within_24h;
DROP VIEW IF EXISTS w4_funnel_metrics;
DROP VIEW IF EXISTS w4_unique_paid_orders;
DROP VIEW IF EXISTS w4_paid_amount_summary;
DROP VIEW IF EXISTS w4_median_nearby;

-- 1. 统计非测试曝光用户数。
SELECT COUNT(DISTINCT user_id) AS exposed_users
FROM events
WHERE event_name = 'coupon_exposure' AND is_test = 0;

-- 2. 建立“结算后 24 小时内支付”的用户集合。
-- 24 小时必须从每位用户自己的 checkout_view 时刻向后计算，不能写成统一的次日午夜。
CREATE VIEW w4_paid_within_24h AS
SELECT DISTINCT user_id
FROM events
WHERE 0; -- TODO：用 checkout_view 与 payment_success 的用户和时间做匹配。

-- 3. 输出三种漏斗口径。保留这些列名，自检会读取它们。
CREATE VIEW w4_funnel_metrics AS
WITH counts AS (
  SELECT
    COUNT(DISTINCT CASE WHEN event_name='coupon_exposure' AND is_test=0 THEN user_id END) AS exposed_users,
    0 AS checkout_users,            -- TODO：自然日非测试结算用户数
    0 AS paid_same_day_users,       -- TODO：自然日非测试支付用户数
    (SELECT COUNT(*) FROM w4_paid_within_24h) AS paid_within_24h_users
  FROM events
)
SELECT
  exposed_users,
  checkout_users,
  paid_same_day_users,
  paid_within_24h_users,
  ROUND(1.0 * paid_same_day_users / NULLIF(exposed_users, 0), 4) AS exposure_to_pay,
  ROUND(1.0 * paid_same_day_users / NULLIF(checkout_users, 0), 4) AS checkout_to_pay,
  ROUND(1.0 * paid_within_24h_users / NULLIF(checkout_users, 0), 4) AS checkout_to_pay_24h
FROM counts;

SELECT * FROM w4_funnel_metrics;

-- 4. 按 order_id 去重支付成功事件，避免 E13/E14 重复计数。
CREATE VIEW w4_unique_paid_orders AS
SELECT order_id, amount
FROM events
WHERE 0; -- TODO：只保留非测试 payment_success，并按 order_id 去重。

-- 5. 计算支付订单数、平均值、中位数、最小值和最大值。
CREATE VIEW w4_paid_amount_summary AS
SELECT
  0 AS unique_paid_orders,
  0.0 AS average_amount,
  0.0 AS median_amount,
  0.0 AS min_amount,
  0.0 AS max_amount
WHERE 1; -- TODO：替换为基于 w4_unique_paid_orders 的统计查询。

SELECT * FROM w4_paid_amount_summary;

-- 6. 输出按金额排序后位于中位数前一位、中位数、后一位的三个订单样本。
CREATE VIEW w4_median_nearby AS
SELECT order_id, amount, 0 AS amount_rank
FROM w4_unique_paid_orders
WHERE 0; -- TODO：使用 ROW_NUMBER() 和 COUNT() OVER () 找到中间三条。

SELECT * FROM w4_median_nearby ORDER BY amount_rank;

-- 最后在 metric-definition.md 写出三种口径为什么会产生不同数字。
