# 《醒醒！分钱了》(Snooze & Lose) — Dify 海报工作流生成与二次精修验证报告

## 1. 链路概览与合规性核查

按照项目承诺（`ledger/promise.md` 第 6 条及修订 2 豁免记录），宣传海报完整走通了 **「Dify Workflow DSL 构建 → 用户已登录 Dify 工作台导入并调用自有模型生成初稿 → 留存溯源证据 → 赛事级二次视觉精修与多格式导出 → 逐页视觉核验」** 的端到端闭环：

1. **原始 AMD DSL 模板完整保留**：`宣传海报与Dify工作流/dify-amd-poster-workflow.yml`（及工程内镜像 `reverse-ux-wakeup/poster/dify-amd-poster-workflow.yml`）完整保留 `version: '0.1.5'` 标准 3 节点（`Start -> LLM -> End`）结构与 `amdtokenfactory/amdtokenfactory` 插件依赖声明。
2. **真实调用用户配置模型生成初稿**：在用户自行登录的 Dify Cloud 独立会话（应用地址：`https://cloud.dify.ai/app/6d35d96e-8b4e-44b4-a5d9-b40d9e6dafce/workflow`）中导入上述 DSL，按用户指示切换至用户已配置凭证的 **`深度求索 (langgenius/deepseek/deepseek)` → `deepseek-v4-pro`** 模型真实执行测试运行。
3. **凭证零触碰与安全合规**：全流程未打开任何 API Key 设置弹窗、未读取或打印任何密钥明文，也未关闭用户的 `dify-window` 登录会话；溯源截图 `dify-poster-provenance.png` 经视觉检查确认仅包含工作流节点绿勾状态、模型标识与 HTML 输出摘要，零敏感信息暴露。

---

## 2. Dify 工作流实际运行记录

| 核查维度 | 实测记录值 |
| :--- | :--- |
| **Dify 工作流架构** | `开始 (Start)` → `海报生成 LLM 节点` → `结束 (End)`（全绿勾通过） |
| **调用模型供应商与模型** | `langgenius/deepseek/deepseek` · **`deepseek-v4-pro` (`CHAT`)** |
| **关键生成参数** | `max_tokens = 16384`，`思考模式 = False`（防止长代码输出截断） |
| **运行批次与状态** | `Test Run (13:02:55)` · **状态：成功 (SUCCESS)** |
| **运行耗时与 Token 消耗** | 耗时 **`34.314s`** · 总消耗 **`6,401 Tokens`** |
| **原始输出完整性** | 完整 `<!DOCTYPE html> ... </html>` 单文件海报初稿（`19,689` 字节 / `18,267` 字符，零截断） |
| **留存证据文件** | `dify-poster-provenance.png`（运行界面溯源图）、`dify-raw-output.html`（未修改初稿存档） |

---

## 3. 从 Dify 初稿到终版海报的二次精修对比

在保留 `dify-raw-output.html` 确立的「工业防爆警戒黄黑斜纹 + 早八刺眼红 + 404 契约账本纸」Neo-Brutalist 视觉母题基础上，二次精修重点完成了以下工程对齐与审美升级：

1. **100% 对齐实机代码参数与账本守恒数学模型**：
   - 将初稿中的概念化金额统一校准为 `src/core/dormEngine.ts` 的真实分值状态机参数：初始总池 `4 × ¥50.00 = ¥200.00 (20,000 分)`；`1号床·卷王老张 (¥56.50)`、`2号床·早八阿强 (¥47.00，社死打字滴血 -¥3.00)`、`3号床·回笼觉小李 (¥56.50，突袭反杀 +¥6.50)`、`4号床·死睡阿伟 (¥40.00，超时违约 -¥10.00)`，底部显著标注守恒不变量 `56.50 + 47.00 + 56.50 + 40.00 ≡ ¥200.00` 与 `∑ balanceCents + poolCents ≡ 20000 分`。
   - 精准对应 5 大逆向交互组件真实通关规则：`0.8s` 防梦游安全栓 + `9.8G` 重力倒退滑块、禁 `Ctrl+V` 且兼容中文输入法 `composition` 的社死认怂手打（每 10s 滴血 `-¥1`）、正弦摇摆且每次按键 `0–9` 重新洗牌的室友突袭算术、经 DFS 验证 100% 可解的 `5×5 / 6×6` 同色连线、经 BFS 最短路验证 `10–14` 步无碰撞出库的 `6×6` 早高峰挪车。
2. **重绘全套高精度内联 SVG 信息图与拟真界面剪影**：
   - 主视觉右侧嵌入 `404寝室·2号床 07:00:08` 早八生死局手机壳剪影；
   - `LOOP 01` 绘制带双向资金流向虚线、独立金额胶囊与突袭查岗连线的 4 床位零和分钱飞轮图；
   - `ANTI-UX × 5` 为每一关配备专属微型矢量交互示意图与绿色「确定性通关规律」底栏；
   - 底部配置三大硬核工程底座卡片（`LEDGER` / `SOLVER` / `DUAL-MODE`）及 `404` 专属局域网扫码联机矢量二维码模块。
3. **提供双格式零依赖可编辑工程源文件**：
   - `poster-editable.html`（`1200×1800`，CSS 变量集中管理配色 + 中文注释分区 DOM，支持任意代码编辑器或浏览器直接改字重导）；
   - `poster-editable.svg`（`1200×1800`，按 `<g id="...">` 语义图层组织的纯矢量独立 SVG 文件，支持 Figma / Illustrator 无损二次编辑）。

---

## 4. 渲染导出规格与多轮视觉核验（Visual QA）结果

使用独立无头浏览器会话（`AGENT_BROWSER_SESSION=poster-render`，视口 `1200×1800`、`deviceScaleFactor = 2`，核验完毕后已关闭该临时会话）完成渲染与 `Read` 逐图视觉审查：

- **第一轮自检与修复**：发现初版 `LOOP 01` 流转箭头胶囊与床位卡片边角存在轻微贴靠，且无头 Chromium 对 `<svg><text>` 内置彩色 Emoji 渲染偏淡；随即拓宽中部走廊坐标（`x=188..512`）、重排非重叠胶囊锚点，并将 SVG 内嵌 Emoji 全部替换为高对比纯矢量几何图形与文字角标。
- **第二轮自检与修复**：
  1. 发现默认 `pdf` 命令按美标信纸（`612×792 pt`）分页导致左右两侧留出窄白边；遂改用 CDP `Page.printToPDF`（开启 `preferCSSPageSize: true, printBackground: true, paperWidth: 12.5, paperHeight: 18.75, margin: 0`）直出，修正后 `MediaBox` 精确锁定为 **`[0 0 900 1350]`（严格 2:3 满版比例，共 1 页，四边零白边）**。
  2. 发现独立 `poster-editable.svg` 底部深色工程栏标题末尾与右侧徽章轻微贴靠；精简标题字距并右移徽章后重新渲染核验，确认彻底消除重叠。
- **最终成品核验结论**：
  - `poster-final.png`：**`2400 × 3600 px`**（1.2 MB），字体锐利、色彩饱满、无任何裁切或错位。
  - `poster-final.pdf`：**单页全矢量 `900 × 1350 pt`**（1.5 MB），四边满版出血、零多余空白页、印刷放大无锯齿。
  - `poster-editable.svg` & `poster-editable.html`：XML/DOM 解析零报错（`parserErr: false`），版式与导出成品严格一致。
