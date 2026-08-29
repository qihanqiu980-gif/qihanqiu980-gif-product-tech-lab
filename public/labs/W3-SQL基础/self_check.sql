.headers off
.mode list
.separator |

-- 这个文件检查学员在 exercises.sql 中创建的四个固定命名视图。
-- 推荐运行 sh self_check.sh；脚本还会检查 TODO 和 notes.md。
WITH checks(check_item, actual, expected) AS (
  SELECT '目标明细行数', CAST((SELECT COUNT(*) FROM w3_target_orders) AS TEXT), '10'
  UNION ALL SELECT '目标唯一订单', CAST((SELECT COUNT(DISTINCT order_id) FROM w3_target_orders) AS TEXT), '9'
  UNION ALL SELECT '目标唯一用户', CAST((SELECT unique_users FROM w3_target_summary) AS TEXT), '7'
  UNION ALL SELECT '汇总原始行数', CAST((SELECT row_count FROM w3_target_summary) AS TEXT), '10'
  UNION ALL SELECT '汇总唯一订单', CAST((SELECT unique_orders FROM w3_target_summary) AS TEXT), '9'
  UNION ALL SELECT '目标原始金额', printf('%.2f', (SELECT raw_paid_amount FROM w3_target_summary)), '729.50'
  UNION ALL SELECT '异常记录数', CAST((SELECT COUNT(*) FROM w3_anomalies) AS TEXT), '5'
  UNION ALL SELECT '异常 row_id 集合', COALESCE((SELECT group_concat(row_id, ',') FROM (SELECT row_id FROM w3_anomalies ORDER BY row_id)), '(empty)'), '8,16,17,18,19'
  UNION ALL SELECT '渠道数', CAST((SELECT COUNT(*) FROM w3_channel_summary) AS TEXT), '3'
  UNION ALL SELECT '渠道唯一订单合计', CAST((SELECT SUM(paid_orders) FROM w3_channel_summary) AS TEXT), '12'
  UNION ALL SELECT '渠道金额合计', printf('%.2f', (SELECT SUM(paid_amount) FROM w3_channel_summary)), '1097.50'
  UNION ALL SELECT 'app 唯一订单', CAST(COALESCE((SELECT paid_orders FROM w3_channel_summary WHERE channel='app'), -1) AS TEXT), '5'
  UNION ALL SELECT 'web 唯一订单', CAST(COALESCE((SELECT paid_orders FROM w3_channel_summary WHERE channel='web'), -1) AS TEXT), '4'
  UNION ALL SELECT 'miniapp 唯一订单', CAST(COALESCE((SELECT paid_orders FROM w3_channel_summary WHERE channel='miniapp'), -1) AS TEXT), '3'
)
SELECT check_item,
       CASE WHEN actual = expected THEN 'PASS' ELSE 'FAIL' END AS result,
       actual,
       expected
FROM checks;
