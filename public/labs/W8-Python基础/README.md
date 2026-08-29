# W8 Python 实验：订单 JSON 自动摘要

只依赖 Python 标准库，无需安装第三方包。

```bash
python3 starter.py orders.json
python3 starter.py orders_invalid.json
```

第一个命令应生成 `output/summary.txt` 和 `output/exceptions.csv`。第二个命令应给出可恢复错误，而不是一串难以理解的崩溃信息。

练习：补全 `summarize()` 中按渠道汇总的部分，并让正常订单数、支付金额、异常行数与 `expected-output.txt` 一致。
