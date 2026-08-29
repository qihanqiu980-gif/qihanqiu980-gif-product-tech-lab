#!/bin/sh
set -eu

cd "$(dirname "$0")"

sql_file=${1:-exercises.sql}
record_file=${2:-reconciliation.md}
failed=0

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "FAIL | 未找到 sqlite3，请先安装 SQLite。"
  exit 1
fi

if grep -Eq 'TODO|WHERE[[:space:]]+0[;[:space:]]|0 AS paid_orders|0 AS joined_rows' "$sql_file"; then
  echo "FAIL | $sql_file 仍有 TODO 或占位查询。"
  failed=1
else
  echo "PASS | SQL 中没有遗留 TODO 或占位查询。"
fi

db_file=$(mktemp "${TMPDIR:-/tmp}/w5-self-check.XXXXXX.db")
trap 'rm -f "$db_file"' EXIT HUP INT TERM
sqlite3 -batch -bail "$db_file" < setup.sql
if ! sqlite3 -batch -bail "$db_file" < "$sql_file" >/dev/null; then
  echo "FAIL | $sql_file 执行失败。"
  exit 1
fi

check_output=$(sqlite3 -batch -bail "$db_file" < self_check.sql)
printf '%s\n' "$check_output"
if printf '%s\n' "$check_output" | grep -q '|FAIL|'; then
  failed=1
fi

if [ ! -f "$record_file" ]; then
  echo "FAIL | 找不到 $record_file。"
  failed=1
else
  for field in 'orders 基线' 'orders + users' 'orders + items' 'items 聚合后再 JOIN'; do
    if awk -F '|' -v field="$field" '
      function trim(value) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        return value
      }
      trim($2) == field && trim($3) != "" { found=1 }
      END { exit !found }
    ' "$record_file"; then
      echo "PASS | 对账记录包含内容：$field"
    else
      echo "FAIL | 对账记录尚未填写：$field"
      failed=1
    fi
  done

  for field in '未匹配用户' '未匹配订单明细' '金额对不上' '数据事实' '合理推测' '不能证明的因果'; do
    if grep -Eq "^- ${field}：[[:space:]]*[^[:space:]]" "$record_file"; then
      echo "PASS | 对账记录包含内容：$field"
    else
      echo "FAIL | 对账记录尚未填写：$field"
      failed=1
    fi
  done
fi

if [ "$failed" -ne 0 ]; then
  echo "W5 自检未通过，请修正 FAIL 项后重跑。"
  exit 1
fi

echo "W5 自检全部通过。"
