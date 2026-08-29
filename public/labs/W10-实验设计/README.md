# W10 埋点与 A/B 实验诊断

使用 SQLite 检查事件重复、属性缺失、实验分流比例和主指标/护栏冲突。教学数据同时故意制造两个问题：A:B 分流为 45:55，且只有前 90 位用户生成了 `checkout_view`，所以必须先做分母覆盖检查，不能直接比较转化率。

```bash
sqlite3 w10_lab.db < setup.sql
sqlite3 -header -column w10_lab.db < analysis.sql
sqlite3 -header -column w10_lab.db < self_check.sql
```

`analysis.sql` 会依次检查 SRM、重复支付、关键属性缺失、assigned→checkout 分母覆盖，再计算主指标与投诉护栏。`self_check.sql` 只确认教学数据中的故障仍与预期一致，不替你做实验决策。

先填写 `decision-record.md` 的“预先决策规则”，再看结果。不要看到显著或上涨后倒推规则。完成后再打开 `decision-record-answer.md` 对照：重点不是逐字一致，而是结论是否先处理数据质量、是否明确当前证据不能证明因果。
