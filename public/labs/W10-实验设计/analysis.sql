.headers on
.mode column

-- 1. SRM 快速检查：当前 A:B 是否符合预期 50:50？
SELECT group_name, COUNT(*) AS users, ROUND(100.0*COUNT(*)/(SELECT COUNT(*) FROM experiment_users),1) AS pct
FROM experiment_users GROUP BY group_name;

-- 2. 检查支付事件与 order_id 重复。
SELECT order_id, COUNT(*) AS rows
FROM events WHERE event_name='payment_success'
GROUP BY order_id HAVING COUNT(*)>1;

-- 3. 检查分组、分配时间和平台属性缺失。
SELECT
  SUM(CASE WHEN group_name IS NULL OR TRIM(group_name)='' THEN 1 ELSE 0 END) AS missing_group,
  SUM(CASE WHEN assigned_at IS NULL OR TRIM(assigned_at)='' THEN 1 ELSE 0 END) AS missing_assigned_at,
  SUM(CASE WHEN platform IS NULL OR TRIM(platform)='' THEN 1 ELSE 0 END) AS missing_platform
FROM experiment_users;

-- 4. 先看 assigned 用户中有多少真正进入 checkout_view，避免分母覆盖不一致。
SELECT u.group_name,
       COUNT(DISTINCT u.user_id) AS assigned_users,
       COUNT(DISTINCT CASE WHEN e.event_name='checkout_view' THEN u.user_id END) AS checkout_users,
       ROUND(1.0*COUNT(DISTINCT CASE WHEN e.event_name='checkout_view' THEN u.user_id END)
         / NULLIF(COUNT(DISTINCT u.user_id),0), 4) AS assigned_to_checkout_coverage
FROM experiment_users u
LEFT JOIN events e ON u.user_id=e.user_id
GROUP BY u.group_name;

-- 5. 按组计算进入结算用户、去重支付用户和转化率。
WITH metrics AS (
  SELECT u.group_name,
         COUNT(DISTINCT CASE WHEN e.event_name='checkout_view' THEN u.user_id END) AS checkout_users,
         COUNT(DISTINCT CASE WHEN e.event_name='payment_success' THEN u.user_id END) AS paid_users,
         COUNT(DISTINCT CASE WHEN e.event_name='complaint' THEN u.user_id END) AS complaint_users
  FROM experiment_users u LEFT JOIN events e ON u.user_id=e.user_id
  GROUP BY u.group_name
)
SELECT *,
       ROUND(1.0*paid_users/NULLIF(checkout_users,0),4) AS pay_rate,
       ROUND(1.0*complaint_users/NULLIF(checkout_users,0),4) AS complaint_rate
FROM metrics;

-- 6. 在 decision-record.md 回答：当前是否可全量？缺少哪些证据？
