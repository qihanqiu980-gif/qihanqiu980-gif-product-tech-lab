.headers off
.mode list
.separator |

-- 推荐通过 sh self_check.sh 运行；脚本还会检查 TODO 与指标口径表。
WITH checks(check_item, actual, expected) AS (
  SELECT '曝光用户数', CAST((SELECT exposed_users FROM w4_funnel_metrics) AS TEXT), '10'
  UNION ALL SELECT '结算用户数', CAST((SELECT checkout_users FROM w4_funnel_metrics) AS TEXT), '7'
  UNION ALL SELECT '自然日支付用户数', CAST((SELECT paid_same_day_users FROM w4_funnel_metrics) AS TEXT), '4'
  UNION ALL SELECT '24小时支付用户数', CAST((SELECT paid_within_24h_users FROM w4_funnel_metrics) AS TEXT), '4'
  UNION ALL SELECT '曝光到支付转化率', printf('%.4f', (SELECT exposure_to_pay FROM w4_funnel_metrics)), '0.4000'
  UNION ALL SELECT '结算到支付转化率', printf('%.4f', (SELECT checkout_to_pay FROM w4_funnel_metrics)), '0.5714'
  UNION ALL SELECT '结算后24小时转化率', printf('%.4f', (SELECT checkout_to_pay_24h FROM w4_funnel_metrics)), '0.5714'
  UNION ALL SELECT 'U03不在24小时集合', CAST((SELECT COUNT(*) FROM w4_paid_within_24h WHERE user_id='U03') AS TEXT), '0'
  UNION ALL SELECT '去重支付订单数', CAST((SELECT unique_paid_orders FROM w4_paid_amount_summary) AS TEXT), '5'
  UNION ALL SELECT '平均支付金额', printf('%.2f', (SELECT average_amount FROM w4_paid_amount_summary)), '2077.00'
  UNION ALL SELECT '支付金额中位数', printf('%.2f', (SELECT median_amount FROM w4_paid_amount_summary)), '89.00'
  UNION ALL SELECT '最小支付金额', printf('%.2f', (SELECT min_amount FROM w4_paid_amount_summary)), '39.00'
  UNION ALL SELECT '最大支付金额', printf('%.2f', (SELECT max_amount FROM w4_paid_amount_summary)), '9999.00'
  UNION ALL SELECT '中位数附近样本',
    COALESCE((SELECT group_concat(sample, ',') FROM (
      SELECT order_id || ':' || printf('%.2f', amount) AS sample
      FROM w4_median_nearby ORDER BY amount_rank
    )), '(empty)'),
    'O03:59.00,O01:89.00,O05:199.00'
)
SELECT check_item,
       CASE WHEN actual = expected THEN 'PASS' ELSE 'FAIL' END AS result,
       actual,
       expected
FROM checks;
