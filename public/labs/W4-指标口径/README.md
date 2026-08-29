# W4 指标口径实验：同一漏斗的三种转化率

你会使用 SQLite 计算曝光、结算、支付漏斗，并验证“分母、去重键和时间窗口变化会改变结论”。数据均为教学模拟。

```bash
sqlite3 w4_lab.db < setup.sql
sqlite3 -header -column w4_lab.db < exercises.sql
```

完成 SQL 后填写 `metric-definition.md`，再运行：

```bash
sh self_check.sh
```

自检会用临时数据库执行你的 `exercises.sql`，验证自然日与真实滚动 24 小时窗口、支付订单去重、平均值、中位数和中位数附近样本，并检查指标口径表是否完整。不要只提交一个百分比，必须同时写样本数、时间窗口、去重键、排除规则和护栏指标。

注意：滚动 24 小时不是“截至次日午夜”。本数据中 U03 在结算后 24 小时 59 分钟才支付，因此不能计入结算后 24 小时转化。

通过自检后再运行 `answers.sql` 对照写法。
