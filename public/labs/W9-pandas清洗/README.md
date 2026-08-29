# W9 pandas 实验：可审计的数据清洗

本周资料故意包含空 ID、重复订单、字符串金额、负数、未知状态和错误时间。不要直接删除；先标记，再分流到 clean 与 quarantine。

安装依赖（如果电脑尚未安装）：

```bash
python3 -m pip install pandas
```

运行：

```bash
python3 starter.py
```

起始脚本会生成 `output/orders_clean.csv`、`output/orders_quarantine.csv`、`output/quality_report.txt`，但保留 TODO 时会明确显示“质量规则已实现: False”，不能把行数守恒当成清洗完成。

完成两个 TODO，并把 `QUALITY_RULES_IMPLEMENTED` 改为 `True` 后运行：

```bash
python3 self_check.py
```

只有看到 `PASS` 才表示两条规则、行数守恒和各问题计数同时符合预期。卡住时可运行 `python3 answer.py`，并把 `answer_output/quality_report.txt` 与 `expected-quality-report.txt` 对照；不要直接覆盖自己的脚本。
