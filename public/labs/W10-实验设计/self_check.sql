.headers on
.mode column

DROP TABLE IF EXISTS temp.qa_checks;
CREATE TEMP TABLE qa_checks AS
WITH checks AS (
  SELECT 'A 组分配人数为 45' AS check_name,
         (SELECT COUNT(*) FROM experiment_users WHERE group_name='A') = 45 AS passed
  UNION ALL
  SELECT 'B 组分配人数为 55',
         (SELECT COUNT(*) FROM experiment_users WHERE group_name='B') = 55
  UNION ALL
  SELECT '三个关键分配属性均无缺失',
         (SELECT COUNT(*) FROM experiment_users
          WHERE group_name IS NULL OR TRIM(group_name)=''
             OR assigned_at IS NULL OR TRIM(assigned_at)=''
             OR platform IS NULL OR TRIM(platform)='') = 0
  UNION ALL
  SELECT 'checkout_view 覆盖 90/100 位分配用户',
         (SELECT COUNT(DISTINCT user_id) FROM events WHERE event_name='checkout_view') = 90
  UNION ALL
  SELECT '存在 O050 重复支付事件',
         (SELECT COUNT(*) FROM events WHERE event_name='payment_success' AND order_id='O050') = 2
)
SELECT * FROM checks;

SELECT check_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result FROM qa_checks;

SELECT CASE WHEN MIN(passed)=1 THEN 'PASS：数据故障与教学预期一致。'
            ELSE 'FAIL：setup.sql 或分析假设发生漂移。' END AS overall
FROM qa_checks;
