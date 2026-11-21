# 《醒醒！分钱了》(Snooze & Lose) — `x 黑客松` 参赛交付总览

> **一句话定位**：一款用户每天早上恨得牙痒痒、前一天晚上却抢着交押金绑定的 **4 人大学寝室早起契约逆向 UX 应用** —— **“你多睡的每一分钟，都在亲手给室友加鸡腿。”**

本文件夹汇总了 **3 套 Finder 直接双击即玩的零依赖单文件 HTML**、**一键局域网联机启动脚本**、完整工程源码、404 寝室五幕式答辩讲稿、Dify × AMD Free Token Factory 海报工作流与全链路验证证据。

---

## 一、 顶层目录导航（含 3 套双击即玩 HTML）

```text
./
├── 醒醒分钱了-双击即玩版.html              # ⭐ [形态1] 手机壳 + 404寝室上帝导播切换台全景版（Finder 直接双击即玩）
├── 醒醒分钱了-4部联机手机同屏版.html        # ⭐ [形态2] 4部寝室手机一字并排实时联机同屏墙（支持真 WebSocket 4端互坑 & 离线联动）
├── 醒醒分钱了-单部手机纯享Demo版.html       # ⭐ [形态3] 仅展示 1 部居中手机的沉浸纯享版（手机内全闭环走完所有关卡与突袭结算）
├── 一键启动局域网联机服务.command           # ⭐ macOS 双击一键拉起 :5173 + :5174 多手机扫码实时联机服务并自动打开浏览器
├── README.md                              # 本文件：总目录索引与零门槛体验指南
├── reverse-ux-wakeup/                    # 完整前端 + 局域网实时联机工程源码与自动化测试套件
│   ├── README.md                         # 工程架构、5大逆向机制确定性通关指南与开发命令
│   ├── src/                              # 200元资金守恒引擎、三视图舞台及5大逆向交互组件
│   ├── server/syncServer.mjs             # 轻量 HTTP (/api/lan-info) + WebSocket 多手机实时同步服务
│   └── scripts/                          # 双服务启动器、三合一单文件打包器 (build-standalone.mjs) 与求解器
├── 答辩讲稿与演示指南/
│   └── 404寝室答辩故事讲稿与演示指南.md    # 5分钟高戏剧张力五幕式故事讲稿、评委Q&A防御矩阵与控场手册
├── 宣传海报与Dify工作流/
│   ├── dify-amd-poster-workflow.yml      # 可一键导入 Dify 的 AMD Free Token Factory 海报生成工作流 DSL
│   └── README-dify-amd.md                # Dify 插件配置、工作流导入运行与二次可编辑海报精修指南
└── 验证证据与截图/
    ├── app-e2e-verification.md           # 全量单测、DFS/BFS 数学求解与真实浏览器端到端实测验证报告
    ├── screen-quad-phones-lan.png        # 实测图：4部联机手机同屏版跨机实时突袭查岗
    ├── screen-single-phone-demo.png      # 实测图：单部手机纯享Demo版无导播台独立闭环
    └── screen-*.png                      # 其余 7 张全机制与结算单实测高清截图
```

---

## 二、 三种视觉形态一键打开方式（支持双击 `file://` 与在线 `http://`）

无论是否启动后端服务，以下 3 个 HTML 文件均可在 Finder 中**直接双击秒开**（页面顶部导航栏亦支持三视图实时互跳）：

| 演示形态 | Finder 直接双击文件 | 本地服务在线 URL (`npm run dev:lan`) | 适用场景 |
| --- | --- | --- | --- |
| **1. 上帝导播全景版** | `醒醒分钱了-双击即玩版.html` | `http://localhost:5173/` | 路演主屏控场：左看手机特写，右看五幕快进、账本守恒与 4 床位扫码二维码 |
| **2. 4部联机手机同屏墙** | `醒醒分钱了-4部联机手机同屏版.html` | `http://localhost:5173/?view=quad` | 直观展现 4 人寝室博弈：老张手机点「突袭查岗TA」，小李手机瞬间爆闪弹出晃动算术题 |
| **3. 单部手机纯享Demo版** | `醒醒分钱了-单部手机纯享Demo版.html` | `http://localhost:5173/?view=single` | 100% 聚焦单机 App 体验：无右侧导播台，单靠手机内按钮独立完成闹钟、闯关、突袭与结算 |

> **开启多台真实手机 Wi‑Fi 扫码联机**：双击 `一键启动局域网联机服务.command`（或在 `reverse-ux-wakeup` 下执行 `npm run dev:lan`），4 部同屏手机将作为 4 个真实 WebSocket 客户端自动接入 `:5174`，并与现场扫码连入的真机毫秒级双向同步！

---

## 三、 查看答辩讲稿与导入 Dify 海报工作流

- **答辩讲稿与控场手册**：`./答辩讲稿与演示指南/404寝室答辩故事讲稿与演示指南.md`
- **Dify × AMD Free Token Factory 工作流**：参阅 `./宣传海报与Dify工作流/README-dify-amd.md`，在 Dify 导入 `./宣传海报与Dify工作流/dify-amd-poster-workflow.yml` 即可复现。

---

## 四、 全量自动化测试与重打包命令

```bash
cd "/Users/a27/Projects/x 黑客松/reverse-ux-wakeup"

npx tsc --noEmit                 # 1. TypeScript 严格静态类型检查
npm test                         # 2. Vitest 单元与多端同步集成测试（含 1500 步随机 Fuzz 守恒断言）
node scripts/verify-puzzles.mjs  # 3. 零依赖 DFS/BFS 关卡数学可解性与 10/12/14 最优步数验证
npm run build                    # 4. 生产构建 + 一次性重新生成根目录全部 3 个双击即玩 HTML
```
