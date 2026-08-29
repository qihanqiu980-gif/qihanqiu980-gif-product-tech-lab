# W7 异常验收实验：权限、幂等、分页、冲突和限流

`acceptance-matrix.csv` 是 20 条验收用例的**唯一权威源**。`acceptance-matrix.xlsx` 只是方便填写的派生视图，不要在两个文件中分别改契约。每个测试都必须留下“页面现象、HTTP/业务错误、业务数据、日志关联 ID”至少一种证据。

修改 CSV 后，先同步 XLSX，再做一致性检查：

```bash
# 同步需要 openpyxl；只检查不需要第三方库
python3 matrix_consistency.py --write
python3 matrix_consistency.py --check
```

一致性检查会比较用例顺序与 10 列全部内容，并拒绝非 20 条、重复 ID 或 CSV/XLSX 漂移。

`simulate_api.py` 是无依赖教学模拟器：

```bash
python3 simulate_api.py
python3 simulate_api.py --case IDEM-01
```

默认会逐条执行 CSV 中的 20 个用例，检查 HTTP 序列与核心业务状态。例如幂等创建的真实序列是“首次 `201`，同键重放 `200`”，而不是把三次都写成 `200`。

覆盖边界需要说清：这个模拟器可执行覆盖 `20/20` 条的 API/核心业务分支，但它不能代替真实页面文案、数据库副作用、审计日志或关联 ID 证据。这些仍要在目标系统中执行；完成后先回填权威 CSV 的 `actual_result` / `status` / `review_notes`，再运行 `--write` 刷新 XLSX。
