.headers on
.mode column

-- 1. 分别记录三张表的行数和唯一键数。
DROP VIEW IF EXISTS w5_table_counts;
DROP VIEW IF EXISTS w5_paid_baseline;
DROP VIEW IF EXISTS w5_join_amplification;
DROP VIEW IF EXISTS w5_unmatched_orders;
DROP VIEW IF EXISTS w5_unmatched_items;
DROP VIEW IF EXISTS w5_reconciled_orders;

CREATE VIEW w5_table_counts AS
SELECT 'users' AS table_name, COUNT(*) AS rows, COUNT(DISTINCT user_id) AS unique_keys FROM users
UNION ALL SELECT 'orders', COUNT(*), COUNT(DISTINCT order_id) FROM orders
UNION ALL SELECT 'order_items', COUNT(*), COUNT(DISTINCT item_id) FROM order_items;

SELECT * FROM w5_table_counts;

-- 2. 计算非测试、paid 订单的正确 GMV，不做 JOIN。
CREATE VIEW w5_paid_baseline AS
SELECT 0 AS paid_orders, 0.0 AS correct_gmv -- TODO：替换为订单粒度基线。
;
SELECT * FROM w5_paid_baseline;

-- 3. 订单 JOIN 明细后直接 SUM(o.paid_amount)，观察错误 GMV。
-- 4. 对比 JOIN 后总行数和唯一订单数。
CREATE VIEW w5_join_amplification AS
SELECT 0 AS joined_rows, 0 AS unique_orders, 0.0 AS wrong_gmv -- TODO：替换为订单 JOIN 明细后的结果。
;
SELECT * FROM w5_join_amplification;

-- 5. 找出没有用户记录的订单，以及没有订单记录的明细。
CREATE VIEW w5_unmatched_orders AS
SELECT order_id, user_id FROM orders WHERE 0; -- TODO：找出用户维表中不存在的订单。

CREATE VIEW w5_unmatched_items AS
SELECT item_id, order_id FROM order_items WHERE 0; -- TODO：找出订单表中不存在的明细。

SELECT * FROM w5_unmatched_orders;
SELECT * FROM w5_unmatched_items;

-- 6. 先把明细聚合到订单粒度，再 JOIN 并对账。
CREATE VIEW w5_reconciled_orders AS
SELECT order_id, paid_amount, 0.0 AS item_total, 0 AS units, 0.0 AS amount_gap
FROM orders
WHERE 0; -- TODO：先聚合 order_items，再关联非测试 paid 订单。

SELECT * FROM w5_reconciled_orders ORDER BY order_id;
