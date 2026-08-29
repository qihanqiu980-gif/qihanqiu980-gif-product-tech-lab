.headers on
.mode column

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

CREATE VIEW w5_paid_baseline AS
SELECT COUNT(*) AS paid_orders, ROUND(SUM(o.paid_amount),2) AS correct_gmv
FROM orders o
LEFT JOIN users u ON o.user_id=u.user_id
WHERE o.status='paid' AND COALESCE(u.is_test,0)=0;

CREATE VIEW w5_join_amplification AS
SELECT COUNT(*) AS joined_rows,
       COUNT(DISTINCT o.order_id) AS unique_orders,
       ROUND(SUM(o.paid_amount),2) AS wrong_gmv
FROM orders o
JOIN order_items i ON o.order_id=i.order_id
LEFT JOIN users u ON o.user_id=u.user_id
WHERE o.status='paid' AND COALESCE(u.is_test,0)=0;

CREATE VIEW w5_unmatched_orders AS
SELECT o.order_id, o.user_id
FROM orders o LEFT JOIN users u ON o.user_id=u.user_id
WHERE u.user_id IS NULL;

CREATE VIEW w5_unmatched_items AS
SELECT i.item_id, i.order_id
FROM order_items i LEFT JOIN orders o ON i.order_id=o.order_id
WHERE o.order_id IS NULL;

CREATE VIEW w5_reconciled_orders AS
WITH item_rollup AS (
  SELECT order_id, SUM(item_amount) AS item_total, SUM(quantity) AS units
  FROM order_items GROUP BY order_id
)
SELECT o.order_id, o.paid_amount, r.item_total, r.units,
       ROUND(o.paid_amount-r.item_total,2) AS amount_gap
FROM orders o
LEFT JOIN item_rollup r ON o.order_id=r.order_id
LEFT JOIN users u ON o.user_id=u.user_id
WHERE o.status='paid' AND COALESCE(u.is_test,0)=0;

SELECT * FROM w5_table_counts;
SELECT * FROM w5_paid_baseline;
SELECT * FROM w5_join_amplification;
SELECT * FROM w5_unmatched_orders;
SELECT * FROM w5_unmatched_items;
SELECT * FROM w5_reconciled_orders ORDER BY order_id;
