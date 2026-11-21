#!/bin/bash
# 《醒醒！分钱了》(Rise & Fine) — macOS 跨电脑免依赖一键启动局域网联机服务
# 特性：
#   1. 无需 node_modules / 无需联网 npm install：直接运行预编译零依赖服务端 lan-standalone-server.cjs
#   2. 自动扫描全盘常见 Node.js 安装位置（Homebrew / Apple Silicon / Intel / nvm / fnm / volta / asdf / mise）
#   3. 若目标电脑完全未安装 Node.js，自动优雅回退并在浏览器打开「4部联机手机同屏版.html」，绝不黑屏报错

xattr -d com.apple.quarantine "$0" >/dev/null 2>&1 || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -d "$SCRIPT_DIR/项目完整源码/reverse-ux-wakeup" ]; then
  APP_DIR="$SCRIPT_DIR/项目完整源码/reverse-ux-wakeup"
elif [ -d "$SCRIPT_DIR/reverse-ux-wakeup" ]; then
  APP_DIR="$SCRIPT_DIR/reverse-ux-wakeup"
elif [ -f "$SCRIPT_DIR/server/lan-standalone-server.cjs" ]; then
  APP_DIR="$SCRIPT_DIR"
else
  APP_DIR=""
fi

FALLBACK_HTML="$SCRIPT_DIR/醒醒分钱了-4部联机手机同屏版.html"
if [ ! -f "$FALLBACK_HTML" ] && [ -f "$SCRIPT_DIR/../醒醒分钱了-4部联机手机同屏版.html" ]; then
  FALLBACK_HTML="$SCRIPT_DIR/../醒醒分钱了-4部联机手机同屏版.html"
fi

echo "=============================================================="
echo " 🚨 《醒醒！分钱了》(Rise & Fine) — 404寝室局域网联机启动器"
echo "=============================================================="

find_node_binary() {
  # 1. 优先扫描常见标准目录与版本管理器目录
  local extra_paths=(
    "/opt/homebrew/bin"
    "/usr/local/bin"
    "/opt/local/bin"
    "$HOME/.volta/bin"
    "$HOME/.asdf/shims"
    "$HOME/.fnm/current/bin"
    "$HOME/Library/Application Support/fnm/aliases/default/bin"
    "$HOME/.local/share/mise/shims"
  )

  for dir in "${extra_paths[@]}"; do
    if [ -x "$dir/node" ]; then
      export PATH="$dir:$PATH"
    fi
  done

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  # 2. 扫描 nvm / fnm / asdf / mise 多版本目录（取最新可用版本）
  local versioned_candidates=()
  while IFS= read -r candidate; do
    [ -x "$candidate" ] && versioned_candidates+=("$candidate")
  done < <(
    ls -1d \
      "$HOME"/.nvm/versions/node/*/bin/node \
      "$HOME"/.fnm/node-versions/*/installation/bin/node \
      "$HOME/Library/Application Support/fnm/node-versions"/*/installation/bin/node \
      "$HOME"/.asdf/installs/nodejs/*/bin/node \
      "$HOME"/.local/share/mise/installs/node/*/bin/node \
      "$HOME"/.local/share/*node*/node-*/bin/node \
      2>/dev/null | { sort -V 2>/dev/null || cat; }
  )

  local count="${#versioned_candidates[@]}"
  if [ "$count" -gt 0 ]; then
    echo "${versioned_candidates[$((count - 1))]}"
    return 0
  fi

  return 1
}

# 若本机已有 Rise & Fine 同步服务在线且 5173 可访问，直接复用并打开浏览器
if command -v curl >/dev/null 2>&1; then
  HEALTH_JSON="$(curl -sf --max-time 1 "http://127.0.0.1:5174/api/health" 2>/dev/null || true)"
  if echo "$HEALTH_JSON" | grep -q "reverse-ux-wakeup-sync" && curl -sf --max-time 1 "http://127.0.0.1:5173/" >/dev/null 2>&1; then
    echo "✅ 检测到《醒醒！分钱了》(Rise & Fine) 局域网联机服务已在运行中！"
    echo "👉 正在为您打开电脑总控台：http://localhost:5173/"
    open "http://localhost:5173/"
    sleep 1
    exit 0
  fi
fi

NODE_BIN="$(find_node_binary || true)"

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo ""
  echo "💡 温馨提示：当前电脑未检测到 Node.js 环境（局域网手机扫码服务需要 Node.js）。"
  if [ -f "$FALLBACK_HTML" ]; then
    echo "✅ 正在自动为您切换并打开免安装「醒醒分钱了-4部联机手机同屏版.html」，"
    echo "   无需任何环境即可在同一屏幕上直接体验 4 部寝室手机实时互动！"
    open "$FALLBACK_HTML"
    sleep 2
    exit 0
  else
    echo "请直接双击目录下的 HTML 文件即可免安装运行！"
    read -r -p "按回车键关闭窗口..." _
    exit 0
  fi
fi

echo "✅ 已定位 Node.js 运行时: $NODE_BIN ($("$NODE_BIN" -v 2>/dev/null || echo 'unknown'))"

if [ -z "$APP_DIR" ]; then
  echo "⚠️ 未找到工程源码目录，正在为您直接打开 4 部联机手机同屏版..."
  [ -f "$FALLBACK_HTML" ] && open "$FALLBACK_HTML"
  sleep 2
  exit 0
fi

cd "$APP_DIR" || exit 1

if [ -f "$APP_DIR/server/lan-standalone-server.cjs" ]; then
  echo "🚀 正在免依赖秒速启动局域网多手机扫码联机服务（无需 npm install）..."
  echo ""
  exec "$NODE_BIN" "$APP_DIR/server/lan-standalone-server.cjs" --open
fi

# 开发环境回退路径（当存在 node_modules 时）
if [ -d "$APP_DIR/node_modules" ] && [ -f "$APP_DIR/scripts/start-lan.mjs" ]; then
  (
    for _ in {1..25}; do
      if curl -sf "http://127.0.0.1:5173/" >/dev/null 2>&1; then
        open "http://localhost:5173/"
        exit 0
      fi
      sleep 0.4
    done
  ) &
  exec "$NODE_BIN" "$APP_DIR/scripts/start-lan.mjs"
fi

echo "⚠️ 未找到预编译服务端，正在为您打开免安装 4 部联机手机同屏版..."
[ -f "$FALLBACK_HTML" ] && open "$FALLBACK_HTML"
sleep 2
exit 0
