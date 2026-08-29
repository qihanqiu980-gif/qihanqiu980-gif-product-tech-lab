#!/bin/sh
set -eu

cd "$(dirname "$0")"

sql_file=${1:-exercises.sql}
notes_file=${2:-notes.md}
failed=0

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "FAIL | 未找到 sqlite3，请先安装 SQLite。"
  exit 1
fi

if [ ! -f "$sql_file" ]; then
  echo "FAIL | 找不到 SQL 文件：$sql_file"
  exit 1
fi

if grep -Eq 'TODO|在此写|AND[[:space:]]+\.\.\.|COUNT\(\.\.\.\)|SUM\(\.\.\.\)' "$sql_file"; then
  echo "FAIL | $sql_file 仍有 TODO 或占位写法，请完成并删除对应标记。"
  failed=1
else
  echo "PASS | SQL 中没有遗留 TODO 或占位写法。"
fi

db_file=$(mktemp "${TMPDIR:-/tmp}/w3-self-check.XXXXXX.db")
trap 'rm -f "$db_file"' EXIT HUP INT TERM

sqlite3 -batch -bail "$db_file" < setup.sql
if ! sqlite3 -batch -bail "$db_file" < "$sql_file" >/dev/null; then
  echo "FAIL | $sql_file 执行失败，请先修正 SQL 报错。"
  exit 1
fi

check_output=$(sqlite3 -batch -bail "$db_file" < self_check.sql)
printf '%s\n' "$check_output"
if printf '%s\n' "$check_output" | grep -q '|FAIL|'; then
  failed=1
fi

if [ ! -f "$notes_file" ]; then
  echo "FAIL | 找不到 ${notes_file}；请先运行 cp notes-template.md notes.md 并填写。"
  failed=1
else
  for field in 一行代表 可能的唯一键 时间范围 支付状态 测试数据 优惠券 退款 去重规则 可支持结论 不可支持结论; do
    if grep -Eq "^- ${field}：[[:space:]]*[^[:space:]]" "$notes_file"; then
      echo "PASS | notes.md 已填写：$field"
    else
      echo "FAIL | notes.md 未填写：$field"
      failed=1
    fi
  done
fi

if [ "$failed" -ne 0 ]; then
  echo "W3 自检未通过，请修正 FAIL 项后重跑。"
  exit 1
fi

echo "W3 自检全部通过。"
