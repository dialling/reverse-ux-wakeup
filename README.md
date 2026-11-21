# 《醒醒！分钱了》(Snooze & Lose) — `x 黑客松` 参赛交付总览

> **一句话定位**：一款用户每天早上恨得牙痒痒、前一天晚上却抢着交押金绑定的 **4 人大学寝室早起契约逆向 UX 应用** —— **“你多睡的每一分钟，都在亲手给室友加鸡腿。”**

本文件夹汇总了项目全部可运行源码、404 寝室五幕式现场答辩讲稿、Dify × AMD Free Token Factory 海报工作流与全链路端到端验证证据。

---

## 一、 顶层目录导航

```text
./
├── README.md                              # 本文件：总目录索引与一键体验指南
├── reverse-ux-wakeup/                    # 完整前端 + 局域网实时联机工程源码与自动化测试套件
│   ├── README.md                         # 工程架构、5大逆向机制确定性通关指南与开发命令
│   ├── src/                              # 200元资金守恒引擎、导播台、手机壳及5大逆向交互组件
│   ├── server/syncServer.mjs             # 轻量 HTTP (/api/lan-info) + WebSocket 多手机实时同步服务
│   └── scripts/                          # 一键双服务启动器 (start-lan.mjs) 与 DFS/BFS 关卡求解器
├── 答辩讲稿与演示指南/
│   └── 404寝室答辩故事讲稿与演示指南.md    # 5分钟高戏剧张力五幕式故事讲稿、评委Q&A防御矩阵与控场手册
├── 宣传海报与Dify工作流/
│   ├── dify-amd-poster-workflow.yml      # 可一键导入 Dify 的 AMD Free Token Factory 海报生成工作流 DSL
│   └── README-dify-amd.md                # Dify 插件配置、工作流导入运行与二次可编辑海报精修指南
│   └── (含后续导出的初稿溯源、可编辑 HTML/SVG 海报源码及高清 PNG/PDF 成品)
└── 验证证据与截图/
    ├── app-e2e-verification.md           # 全量单测、DFS/BFS 数学求解与 7 大浏览器端到端实测验证报告
    ├── screen-director-console.png       # 截图1：桌面拟真手机壳 + 404寝室上帝导播台 + 4床位二维码
    ├── screen-slider-and-shame.png       # 截图2：社死认怂书错字归零与10秒滴血扣款分红
    ├── screen-flow-connect.png           # 截图3：同色小球不交叉连线电路实测（含异色碰线短路记录）
    ├── screen-parking-jam.png            # 截图4：6×6早高峰车棚无碰撞挪车出库实测
    ├── screen-parking-and-raid.png       # 截图5：室友突袭查岗：持续摇摆的乱序数字键盘算术
    ├── screen-settlement-bill.png        # 截图6：404寝室今日鸡腿分红结算单与 ¥200.00 守恒审计印章
    └── screen-mobile-fullscreen.png      # 截图7：移动端真机扫码沉浸式全屏自适应界面
```

---

## 二、 30 秒一键启动交互式应用（单机导播 & 多手机扫码联机）

> **路径提示**：因文件夹名称包含空格（`x 黑客松`），在终端执行 `cd` 时请务必加英文双引号。

### 方式 1：局域网多手机扫码实时联机模式（强烈推荐路演现场演示！）
```bash
cd "reverse-ux-wakeup"
npm run dev:lan
```
1. 电脑浏览器打开 [http://localhost:5173](http://localhost:5173)：左侧为高反差拟真手机操作区，右侧为 **「404 寝室上帝导播切换台」**。
2. 导播台底部会自动探测本机局域网 IPv4 并生成 **1–4 号床专属二维码**。
3. 评委或队友手机连接同一 Wi‑Fi / 热点扫码后，将自动隐藏导播台进入对应室友的**真机全屏界面**，手滑扣款、社死滴血与突袭查岗全寝室毫秒级实时同步！

### 方式 2：纯前端单机剧本导播模式（零后端依赖，离线稳健兜底）
```bash
cd "reverse-ux-wakeup"
npm run dev
```
打开 [http://localhost:5173](http://localhost:5173) 即可在导播台一键切换 **第 1–5 幕故事预设**、接管任意床位视角或发起突袭演示。

---

## 三、 查看答辩讲稿与演示控场手册

直接打开：
- `./答辩讲稿与演示指南/404寝室答辩故事讲稿与演示指南.md`

内含按秒编排的 **5 分钟双线并进路演剧本**（深夜立毒誓 → 07:00 躲避滑块 → 07:02 社死打字滴血 → 07:04 连线/挪车大考 → 07:08 老张突袭小李与鸡腿结算单），以及针对评委高频犀利提问（卸载逃逸、代打作弊、熟人伤感情、商业化闭环）的标准应答话术。

---

## 四、 导入 Dify × AMD Free Token Factory 海报工作流

参阅 `./宣传海报与Dify工作流/README-dify-amd.md`：
1. 在 Dify 工作台安装官方 **`AMD Free Token Factory`** 插件（`amdtokenfactory/amdtokenfactory`）并配置免费额度凭证。
2. 点击 **「导入 DSL 文件」**，选择 `./宣传海报与Dify工作流/dify-amd-poster-workflow.yml` 即可一键复现模型初稿生成与二次精修全链路。

---

## 五、 运行全量自动化测试与关卡数学求解验证

详细实测报告与 7 张高清截图位于 `./验证证据与截图/app-e2e-verification.md`。如需现场复跑全部自动化检查：

```bash
cd "reverse-ux-wakeup"

# 1. TypeScript 严格静态类型检查
npx tsc --noEmit

# 2. Vitest 单元测试与多端并发同步集成测试（含 1500 步随机 Fuzz 资金守恒断言）
npm test

# 3. 零依赖 DFS/BFS 数学求解器（证明全部 3 关连线 + 3 关挪车 100% 有解且最优步数 10/12/14 步）
node scripts/verify-puzzles.mjs

# 4. 生产环境构建验证
npm run build
```
