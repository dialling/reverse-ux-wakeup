#!/bin/zsh -l
set -e

# 兼容 Finder 双击启动时的精简环境变量，补充常见 Node 安装路径
export PATH="$HOME/.local/share/pi-node/node-v22.23.2-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/reverse-ux-wakeup"

echo "========================================================"
echo " 🚨 《醒醒！分钱了》(Snooze & Lose) — 404寝室联机导播台"
echo "========================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js，请直接双击同级目录下的「醒醒分钱了-双击即玩版.html」体验纯本地完整版！"
  read -k 1 "?按任意键关闭窗口..."
  exit 1
fi

cd "$APP_DIR"

# 若 5173 与 5174 已经在后台运行，直接打开浏览器而不重复占用端口
if lsof -iTCP:5173 -sTCP:LISTEN -n -P >/dev/null 2>&1 && lsof -iTCP:5174 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "✅ 检测到前端 (:5173) 与局域网同步服务 (:5174) 已在运行中！"
  echo "👉 正在为您打开浏览器导播台：http://localhost:5173/"
  open "http://localhost:5173/"
  sleep 1
  exit 0
fi

# 后台轮询等待前端就绪后自动弹出系统默认浏览器
(
  for i in {1..30}; do
    if curl -sf "http://127.0.0.1:5173/" >/dev/null 2>&1; then
      open "http://localhost:5173/"
      exit 0
    fi
    sleep 0.4
  done
) &

echo "🚀 正在启动前端服务 (:5173) 与多手机扫码同步服务 (:5174)..."
echo "💡 提示：保持此终端窗口开启即可支持手机同一 Wi-Fi 扫码联机；按 Ctrl+C 可停止服务。"
echo ""

node scripts/start-lan.mjs
