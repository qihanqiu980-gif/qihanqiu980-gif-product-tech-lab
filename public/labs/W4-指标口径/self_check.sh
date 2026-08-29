#!/bin/sh
set -eu

cd "$(dirname "$0")"

sql_file=${1:-exercises.sql}
definition_file=${2:-metric-definition.md}
failed=0

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "FAIL | 未找到 sqlite3，请先安装 SQLite。"
  exit 1
fi

if [ ! -f "$sql_file" ]; then
  echo "FAIL | 找不到 SQL 文件：$sql_file"
  exit 1
fi

if grep -Eq 'TODO|WHERE[[:space:]]+0[;[:space:]]|替换为' "$sql_file"; then
  echo "FAIL | $sql_file 仍有 TODO 或占位查询，请完成并删除对应标记。"
  failed=1
else
  echo "PASS | SQL 中没有遗留 TODO 或占位查询。"
fi

db_file=$(mktemp "${TMPDIR:-/tmp}/w4-self-check.XXXXXX.db")
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

if [ ! -f "$definition_file" ]; then
  echo "FAIL | 找不到指标口径表：$definition_file"
  failed=1
else
  for field in 指标 它支持什么决策 分子事件 分母事件 去重键 时间窗口 时区 状态与排除规则 数据延迟 样本数 过程指标 护栏指标 异常值处理 自然日口径结果 '24 小时口径结果' 'U03 是否计入 24 小时' 中位数 中位数附近样本 这个数字不能证明 需要追加的验证; do
    if grep -Eq "^- ${field}：[[:space:]]*[^[:space:]]" "$definition_file"; then
      echo "PASS | 指标口径表已填写：$field"
    else
      echo "FAIL | 指标口径表未填写：$field"
      failed=1
    fi
  done
fi

if [ "$failed" -ne 0 ]; then
  echo "W4 自检未通过，请修正 FAIL 项后重跑。"
  exit 1
fi

echo "W4 自检全部通过。"
