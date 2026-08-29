#!/bin/zsh
set -e

COURSE_DIR="${0:A:h}"
cd "$COURSE_DIR"

NEEDS_BUILD=0
if [ ! -f dist/index.html ] || [ ! -f index.html ]; then
  NEEDS_BUILD=1
elif find src scripts package.json vite.config.ts course-source.html -newer dist/index.html -print -quit 2>/dev/null | grep -q .; then
  NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "缺少已构建的课程文件，且当前电脑没有 npm，无法重新生成课程。"
    echo "请确认整个课程文件夹已完整复制后再试。"
    read -r "?按回车键关闭窗口……"
    exit 1
  fi
  if [ ! -d node_modules ]; then
    echo "首次构建：正在安装课程运行组件……"
    npm install
  fi
  echo "正在生成课程页面……"
  npm run build
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "当前电脑没有可用的 Python 3，无法启动本地课程服务。"
  echo "你仍可尝试直接双击文件夹中的 index.html。"
  read -r "?按回车键关闭窗口……"
  exit 1
fi

COURSE_PORT="${COURSE_PORT:-4317}"
COURSE_NO_OPEN="${COURSE_NO_OPEN:-0}"
COURSE_URL="http://127.0.0.1:${COURSE_PORT}/index.html?v=$(date +%s)"
COURSE_LOG="/tmp/pm-tech-learning-lab-${COURSE_PORT}.log"

if python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(.25); sys.exit(0 if s.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)' "$COURSE_PORT"; then
  if command -v curl >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${COURSE_PORT}/index.html" | grep -q "产品技术实验室"; then
    echo "课程已经在固定地址运行：$COURSE_URL"
    if [ "$COURSE_NO_OPEN" != "1" ]; then open "$COURSE_URL"; fi
    exit 0
  fi
  echo "固定课程端口 ${COURSE_PORT} 正被其他程序使用。"
  echo "请关闭占用程序后重试；保持固定端口可以避免浏览器学习进度被分散到不同地址。"
  read -r "?按回车键关闭窗口……"
  exit 1
fi

echo "课程已启动：$COURSE_URL"
python3 -m http.server "$COURSE_PORT" --bind 127.0.0.1 --directory "$COURSE_DIR" > "$COURSE_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM HUP

READY=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if command -v curl >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${COURSE_PORT}/index.html" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.2
done
if [ "$READY" -ne 1 ] || ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "课程服务启动失败，日志如下："
  tail -n 20 "$COURSE_LOG"
  exit 1
fi
if [ "$COURSE_NO_OPEN" != "1" ]; then open "$COURSE_URL"; fi
echo "课程运行中。学习结束后，关闭此窗口即可停止课程。"
wait "$SERVER_PID"
