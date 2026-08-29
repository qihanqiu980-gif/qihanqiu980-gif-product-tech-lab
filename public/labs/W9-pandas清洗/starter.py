from pathlib import Path
import pandas as pd

INPUT = Path("orders_dirty.csv")
OUTPUT = Path("output")
VALID_STATUS = {"paid", "cancelled", "refunded", "pending"}
VALID_CHANNEL = {"app", "web", "miniapp"}

raw = pd.read_csv(INPUT, dtype={"order_id": "string", "user_id": "string"})
df = raw.copy()

df["paid_amount_num"] = pd.to_numeric(df["paid_amount"], errors="coerce")
df["paid_at_parsed"] = pd.to_datetime(df["paid_at"], errors="coerce")
df["issue_missing_order_id"] = df["order_id"].isna()
df["issue_duplicate_order"] = df.duplicated(subset=["order_id"], keep=False)
df["issue_missing_user"] = df["user_id"].isna()
df["issue_invalid_status"] = ~df["status"].isin(VALID_STATUS)
df["issue_invalid_amount"] = df["paid_amount_num"].isna() | (df["paid_amount_num"] < 0)

# TODO 1：paid 状态的 paid_at 必须可解析。
df["issue_invalid_paid_time"] = False

# TODO 2：channel 必须属于 VALID_CHANNEL。
df["issue_invalid_channel"] = False

# 两个 TODO 都完成后，把这个开关改为 True。它不替代 self_check.py，
# 只是避免起始脚本把“行数守恒”误报成“质量规则已完成”。
QUALITY_RULES_IMPLEMENTED = False

issue_columns = [column for column in df.columns if column.startswith("issue_")]
df["has_issue"] = df[issue_columns].any(axis=1)

clean = df[~df["has_issue"]].copy()
quarantine = df[df["has_issue"]].copy()

OUTPUT.mkdir(exist_ok=True)
clean.to_csv(OUTPUT / "orders_clean.csv", index=False, encoding="utf-8-sig")
quarantine.to_csv(OUTPUT / "orders_quarantine.csv", index=False, encoding="utf-8-sig")

lines = [
    f"原始行数: {len(raw)}",
    f"清洁行数: {len(clean)}",
    f"隔离行数: {len(quarantine)}",
    f"行数守恒: {len(raw) == len(clean) + len(quarantine)}",
    f"质量规则已实现: {QUALITY_RULES_IMPLEMENTED}",
    f"总体自检通过: {QUALITY_RULES_IMPLEMENTED and len(raw) == len(clean) + len(quarantine)}",
]
for column in issue_columns:
    lines.append(f"{column}: {int(df[column].sum())}")
(OUTPUT / "quality_report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
if not QUALITY_RULES_IMPLEMENTED:
    print("\n尚未完成 TODO 1/2。请实现规则、把 QUALITY_RULES_IMPLEMENTED 改为 True，再运行 self_check.py。")
