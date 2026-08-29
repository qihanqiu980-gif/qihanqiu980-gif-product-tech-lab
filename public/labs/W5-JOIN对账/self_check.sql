.headers off
.mode list
.separator |

WITH checks(check_item, actual, expected) AS (
  SELECT 'users 行数', CAST((SELECT rows FROM w5_table_counts WHERE table_name='users') AS TEXT), '6'
  UNION ALL SELECT 'orders 行数', CAST((SELECT rows FROM w5_table_counts WHERE table_name='orders') AS TEXT), '6'
  UNION ALL SELECT 'order_items 行数', CAST((SELECT rows FROM w5_table_counts WHERE table_name='order_items') AS TEXT), '9'
  UNION ALL SELECT 'paid 非测试订单数', CAST((SELECT paid_orders FROM w5_paid_baseline) AS TEXT), '4'
  UNION ALL SELECT '正确 GMV', printf('%.2f', (SELECT correct_gmv FROM w5_paid_baseline)), '440.00'
  UNION ALL SELECT 'JOIN 后行数', CAST((SELECT joined_rows FROM w5_join_amplification) AS TEXT), '6'
  UNION ALL SELECT 'JOIN 后唯一订单', CAST((SELECT unique_orders FROM w5_join_amplification) AS TEXT), '4'
  UNION ALL SELECT '错误放大 GMV', printf('%.2f', (SELECT wrong_gmv FROM w5_join_amplification)), '740.00'
  UNION ALL SELECT '未匹配用户订单', COALESCE((SELECT order_id || ':' || user_id FROM w5_unmatched_orders), '(empty)'), 'O05:U99'
  UNION ALL SELECT '未匹配订单明细', COALESCE((SELECT item_id || ':' || order_id FROM w5_unmatched_items), '(empty)'), 'I08:MISSING'
  UNION ALL SELECT '订单粒度对账行数', CAST((SELECT COUNT(*) FROM w5_reconciled_orders) AS TEXT), '4'
  UNION ALL SELECT '金额差异合计', printf('%.2f', (SELECT SUM(ABS(amount_gap)) FROM w5_reconciled_orders)), '0.00'
)
SELECT check_item,
       CASE WHEN actual = expected THEN 'PASS' ELSE 'FAIL' END AS result,
       actual,
       expected
FROM checks;
