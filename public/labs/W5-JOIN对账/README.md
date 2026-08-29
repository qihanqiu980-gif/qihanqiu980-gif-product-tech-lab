# W5 JOIN 对账实验：为什么 GMV 被放大

本实验故意放入“一张订单含多个商品”的一对多关系。你需要记录每次 JOIN 前后的行数、唯一键和金额，证明放大发生在哪一步。

```bash
sqlite3 w5_lab.db < setup.sql
sqlite3 -header -column w5_lab.db < exercises.sql
```

完成任务 2–6 并填写 `reconciliation.md` 后运行：

```bash
sh self_check.sh
```

自检会拒绝遗留 TODO，验证正确 GMV=440、错误放大 GMV=740、JOIN 行数/唯一订单、两类未匹配键和订单粒度金额差异，同时检查对账记录的十项内容。全部通过后再运行 `answers.sql` 对照写法，不要只提交最终 SQL。
