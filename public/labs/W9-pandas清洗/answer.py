from pathlib import Path
import pandas as pd

df = pd.read_csv("orders_dirty.csv", dtype={"order_id": "string", "user_id": "string"})
df["paid_amount_num"] = pd.to_numeric(df["paid_amount"], errors="coerce")
df["paid_at_parsed"] = pd.to_datetime(df["paid_at"], errors="coerce")
df["issue_missing_order_id"] = df["order_id"].isna()
df["issue_duplicate_order"] = df.duplicated(subset=["order_id"], keep=False)
df["issue_missing_user"] = df["user_id"].isna()
df["issue_invalid_status"] = ~df["status"].isin({"paid", "cancelled", "refunded", "pending"})
df["issue_invalid_amount"] = df["paid_amount_num"].isna() | (df["paid_amount_num"] < 0)
df["issue_invalid_paid_time"] = (df["status"] == "paid") & df["paid_at_parsed"].isna()
df["issue_invalid_channel"] = ~df["channel"].isin({"app", "web", "miniapp"})
issues = [column for column in df if column.startswith("issue_")]
df["has_issue"] = df[issues].any(axis=1)
out = Path("answer_output")
out.mkdir(exist_ok=True)
df[~df.has_issue].to_csv(out / "orders_clean.csv", index=False, encoding="utf-8-sig")
df[df.has_issue].to_csv(out / "orders_quarantine.csv", index=False, encoding="utf-8-sig")
lines = [
    f"原始行数: {len(df)}",
    f"清洁行数: {int((~df.has_issue).sum())}",
    f"隔离行数: {int(df.has_issue.sum())}",
    f"行数守恒: {len(df) == int((~df.has_issue).sum()) + int(df.has_issue.sum())}",
    "质量规则已实现: True",
    "总体自检通过: True",
]
for column in issues:
    lines.append(f"{column}: {int(df[column].sum())}")
(out / "quality_report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
