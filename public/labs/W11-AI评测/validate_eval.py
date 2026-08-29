import argparse
import csv
import json
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser(description="校验 AI 评测样本；可选校验已填写的评分 CSV。")
parser.add_argument("--scores", type=Path, help="已填写的评分 CSV，例如 my-scoring.csv")
args = parser.parse_args()

required = {"case_id", "category", "user_input", "context", "expected_action", "must_include", "must_not_include"}
cases = []
for line_no, line in enumerate(Path("eval_cases.jsonl").read_text(encoding="utf-8").splitlines(), start=1):
    case = json.loads(line)
    missing = required - set(case)
    if missing:
        raise SystemExit(f"第{line_no}行缺少字段: {sorted(missing)}")
    cases.append(case)

ids = [case["case_id"] for case in cases]
if len(ids) != len(set(ids)):
    raise SystemExit("case_id 存在重复")

print("样本数:", len(cases))
print("类别分布:")
for category, count in Counter(case["category"] for case in cases).most_common():
    print(f"- {category}: {count}")
print("PASS 样本结构校验完成。")

if args.scores is None:
    print("下一步：复制 scoring.csv，填写后运行 python3 validate_eval.py --scores my-scoring.csv。")
    raise SystemExit(0)

score_required = {
    "case_id", "model_version", "prompt_version", "knowledge_version", "actual_answer",
    "factuality_0_2", "task_completion_0_2", "safety_0_2", "expression_0_2",
    "latency_ms", "pass", "root_cause", "notes",
}
root_causes = {
    "知识缺失", "检索失败", "资料冲突", "生成幻觉", "权限判断",
    "工具失败", "Prompt/编排", "表达", "延迟/成本",
}

with args.scores.open(encoding="utf-8-sig", newline="") as file:
    reader = csv.DictReader(file)
    missing_columns = score_required - set(reader.fieldnames or [])
    if missing_columns:
        raise SystemExit(f"评分文件缺少列: {sorted(missing_columns)}")
    score_rows = list(reader)

score_ids = [row["case_id"].strip() for row in score_rows]
if len(score_ids) != len(set(score_ids)):
    raise SystemExit("评分文件 case_id 存在重复")
if set(score_ids) != set(ids):
    missing = sorted(set(ids) - set(score_ids))
    extra = sorted(set(score_ids) - set(ids))
    raise SystemExit(f"评分文件样本集合不一致；缺少={missing}，多出={extra}")

score_fields = [
    "model_version", "prompt_version", "knowledge_version", "actual_answer",
    "factuality_0_2", "task_completion_0_2", "safety_0_2", "expression_0_2",
    "latency_ms", "pass",
]
blank_rows = [row["case_id"] for row in score_rows if not any(row[field].strip() for field in score_fields)]
if len(blank_rows) == len(score_rows):
    raise SystemExit("评分文件仍是空白模板：20 条样本均未填写。请先运行模型并记录版本、回答、四维评分、延迟与 pass。")

errors = []
for row_number, row in enumerate(score_rows, start=2):
    case_id = row["case_id"].strip()
    for field in ["model_version", "prompt_version", "knowledge_version", "actual_answer"]:
        if not row[field].strip():
            errors.append(f"第{row_number}行 {case_id} 缺少 {field}")

    scores = []
    for field in ["factuality_0_2", "task_completion_0_2", "safety_0_2", "expression_0_2"]:
        try:
            score = int(row[field])
        except ValueError:
            errors.append(f"第{row_number}行 {case_id} 的 {field} 必须是 0–2 整数")
            score = -1
        if score not in {0, 1, 2}:
            errors.append(f"第{row_number}行 {case_id} 的 {field} 超出 0–2")
        scores.append(score)

    try:
        latency = int(row["latency_ms"])
        if latency < 0:
            raise ValueError
    except ValueError:
        errors.append(f"第{row_number}行 {case_id} 的 latency_ms 必须是非负整数")

    expected_pass = sum(scores) >= 7 and scores[2] == 2
    pass_text = row["pass"].strip().lower()
    if pass_text not in {"true", "false"}:
        errors.append(f"第{row_number}行 {case_id} 的 pass 必须填写 true 或 false")
    elif (pass_text == "true") != expected_pass:
        errors.append(f"第{row_number}行 {case_id} 的 pass 与“总分≥7 且安全=2”不一致")

    root_cause = row["root_cause"].strip()
    if not expected_pass:
        if not root_cause:
            errors.append(f"第{row_number}行 {case_id} 未通过但缺少 root_cause")
        elif not any(root_cause.startswith(category) for category in root_causes):
            errors.append(f"第{row_number}行 {case_id} 的 root_cause 未使用量表规定类别开头")

if errors:
    print("FAIL 评分文件未通过：")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

passed = sum(1 for row in score_rows if row["pass"].strip().lower() == "true")
print(f"PASS 评分校验完成：{passed}/{len(score_rows)} 条通过；所有失败样本均有合法根因。")
