# Dify 海报生成工作流与二次精修源码说明

本目录包含《醒醒！分钱了》(*Snooze & Lose*) 逆向 UX 挑战赛宣传海报的 **Dify 工作流定义文件（DSL）**、**Dify Cloud 真实运行溯源与原始输出留档**，以及 **二次视觉精修后的可编辑海报源码与印刷级成品导出文件**。

---

## 一、 目录文件清单与用途

| 文件名 | 规格 / 大小 | 用途说明 |
| :--- | :--- | :--- |
| `dify-amd-poster-workflow.yml` | Dify DSL `v0.1.5` | 标准 3 节点（`Start -> LLM -> End`）海报生成工作流模板，默认保留 `amdtokenfactory/amdtokenfactory` 模型声明，亦可一键切换为任意已配置模型供应商 |
| `dify-poster-provenance.png` | 工作流运行截图 | 在 Dify Cloud 导入本工作流并调用用户已配置模型（`深度求索 / deepseek-v4-pro`）成功运行生成初稿的真实界面溯源截图（不含任何密钥信息） |
| `dify-raw-output.html` | `1200×1800` HTML | Dify 工作流 LLM 节点单次运行（耗时 `34.314s`、消耗 `6,401 Tokens`）直接输出的未修改原始海报代码留档 |
| `poster-editable.html` | `1200×1800` HTML+SVG | 基于 Dify 初稿结构与文案亮点，对齐实机工程参数并重绘矢量图解后的**可自由二次编辑 HTML 海报源码**（零外部字体/CDN 依赖） |
| `poster-editable.svg` | `1200×1800` 纯矢量 SVG | 按语义图层（`<g id="...">`）分组的**独立纯矢量可编辑 SVG 海报源文件**，支持 Figma / Illustrator / 浏览器直接打开编辑文字与配色 |
| `poster-final.png` | `2400×3600` (2x Retina) | 经无头 Chromium 2 倍超采样无损导出的高清参赛海报 PNG 成品 |
| `poster-final.pdf` | `900×1350 pt` (单页 2:3) | 经 `Page.printToPDF`（`preferCSSPageSize: true`，零边距满版）导出的单页全矢量可印刷海报 PDF 成品 |

---

## 二、 在 Dify 中导入与复现运行步骤

### 路线 A：使用工作空间已配置的任意主流大模型（本次实测采用路径）
1. 登录 Dify 工作台（如 `https://cloud.dify.ai/apps`），确保已在 **设置 → 模型供应商** 中配置好任意可用模型 API Key（例如本次实测使用的 `深度求索 / deepseek-v4-pro`）。
2. 在工作室首页点击 **「导入 DSL 文件 (Import DSL file)」**，上传本目录下的 `dify-amd-poster-workflow.yml`。
3. 打开中间的 LLM 节点，将模型切换为已配置供应商下的高上下文模型，建议设置：
   - `max_tokens`: `16384`（确保完整输出单文件 HTML/CSS/SVG 不截断）
   - `思考模式 (Thinking Mode)`: `False`（直接输出结构化海报源码，缩短响应延迟）
4. 点击右上角 **「测试运行 (Test Run)」**，所有输入变量均内置默认兜底文案，可直接点击开始运行获取完整 HTML 初稿（对应留档文件 `dify-raw-output.html` 与运行截图 `dify-poster-provenance.png`）。

### 路线 B：使用 `AMD Free Token Factory` 插件运行（原 DSL 预设模板）
1. 在 Dify 右上角 **插件 (Plugins) / Marketplace** 搜索并安装官方插件 **`AMD Free Token Factory`**（标识符：`amdtokenfactory/amdtokenfactory`），并在模型供应商设置中填入个人 `rc-` 免费额度 Key。
2. 导入 `dify-amd-poster-workflow.yml` 后无需改动节点供应商，即可直接选用预设的 `Qwen3.8-27B` 或切换为同插件下的 `DeepSeek-V4.1-Flash` 运行。

---

## 三、 二次自由编辑与重新导出指南

### 1. 快速修改文案、数值或主色调
- **编辑 HTML 版（推荐）**：用任意编辑器打开 `poster-editable.html`：
  - 修改顶部 `:root` 中的 `--yellow` (`#FACC15`)、`--red` (`#EF4444`)、`--slate` (`#0F172A`)、`--paper` (`#FAF8F2`) 即可全局换肤；
  - 代码内按 `1. 顶部赛事标识栏`、`2. 主视觉区与真机剪影`、`3. 404寝室 ¥200 零和分钱闭环`、`4. 五大逆向交互关卡`、`5. 底部硬核工程底座与扫码联机` 清晰分区注释，改字保存后刷新浏览器即可实时预览。
- **编辑纯矢量 SVG 版**：将 `poster-editable.svg` 拖入 Figma、Adobe Illustrator 或代码编辑器，直接定位 `<g id="hero-section">`、`<g id="dorm-loop-section">`、`<g id="five-mechanisms">`、`<g id="engineering-footer">` 图层组即可无损缩放与改字。

### 2. 重新导出无裁切满版 PDF 与高清 PNG
- **浏览器手动导出 PDF**：在 Chrome / Edge 中打开 `poster-editable.html`，按下 `Cmd+P` / `Ctrl+P` → 目标选择 **「另存为 PDF」** → 边距设为 **「无 (None)」** → 勾选 **「背景图形 (Background graphics)」**（页面已内置 `@page { size: 1200px 1800px; margin: 0; }`，自动生成单页 2:3 满版矢量 PDF）。
