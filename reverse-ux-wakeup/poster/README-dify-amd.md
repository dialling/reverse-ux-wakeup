# Dify × AMD Free Token Factory 海报生成与精修工作流说明

本目录包含《醒醒！分钱了》(*Snooze & Lose*) 逆向 UX 挑战赛宣传海报的 **Dify 工作流定义文件（DSL）**、**AMD Free Token Factory 原始生成留档** 与 **二次精修可编辑海报源码及成品导出文件**。

---

## 一、 目录文件清单与用途

| 文件路径 | 说明 |
| :--- | :--- |
| `dify-amd-poster-workflow.yml` | 标准 Dify Workflow DSL（`version: '0.1.5'`，声明 `amdtokenfactory/amdtokenfactory` 插件依赖），可直接导入 Dify Cloud 或私有化 Dify 实例一键运行 |
| `dify-amd-provenance.png` | 在 Dify 中真实运行 `AMD Free Token Factory` 模型节点生成海报初稿的工作流界面与调用溯源截图 |
| `dify-amd-raw-output.html` | `AMD Free Token Factory` 模型节点生成的原始未修改 HTML/SVG 海报代码存档 |
| `poster-editable.html` | 基于 Dify AMD 初稿进行版式网格、矢量图解、视觉层级深度精修后的**可自由二次编辑 HTML 海报源码**（1200×1800） |
| `poster-editable.svg` | 独立高分辨率**纯矢量可编辑 SVG 海报源文件**（1200×1800，可在 Figma / Illustrator / 浏览器直接打开编辑文字与图形） |
| `poster-final.png` | 经浏览器无损高分渲染导出的印刷级参赛海报 PNG 成品 |
| `poster-final.pdf` | 经浏览器无裁切导出的可打印参赛海报 PDF 成品 |

---

## 二、 在 Dify 中导入与运行 `AMD Free Token Factory` 的步骤

### 1. 前置插件与免费额度准备（用户侧自行配置，无需向外部暴露密钥）
1. 登录 Dify 工作台（如 `https://cloud.dify.ai/apps`）。
2. 打开右上角 **插件 (Plugins) / Marketplace**，搜索并安装官方插件 **`AMD Free Token Factory`**（标识符：`amdtokenfactory/amdtokenfactory`）。
3. 若尚未绑定凭证，可在 [AMD Token Factory 开发者平台](https://developer.amd.com.cn/login?source=sta8ZpC3e) 免费获取 `rc-` 开头的每日免费额度 API Key，并在 Dify **设置 (Settings) → 模型供应商 (Model Provider) → AMD Free Token Factory** 中填入保存。

### 2. 一键导入工作流 DSL
1. 在 Dify 工作室首页点击 **「导入 DSL 文件 (Import DSL file)」**。
2. 选择本目录下的 `dify-amd-poster-workflow.yml` 上传创建应用。
3. 进入工作流画布后，检查中间的 **「AMD Free Token Factory 海报生成」** LLM 节点：
   - 默认配置模型：`amdtokenfactory/amdtokenfactory` 下的 **`Qwen3.8-27B`**（256K 上下文）。
   - 亦可在节点下拉框中无缝切换为同插件下的 **`DeepSeek-V4.1-Flash`**（1M 上下文，极速流式输出）或 **`Qwen3.8-Flash-Next`**。

### 3. 一键生成与二次精修链路
1. 点击右上角 **「运行 (Run)」**，所有输入项均已内置默认兜底策略，无需手动填写即可直接点击 **「开始运行 (Start Run)」**。
2. 将输出的完整 HTML/SVG 代码保存为 `dify-amd-raw-output.html`，并截取工作流运行成功画面保存为 `dify-amd-provenance.png`。
3. 在初稿结构基础上精修产出的 `poster-editable.html` 与 `poster-editable.svg` 支持任意文本编辑器、Figma 或浏览器实时修改文案与配色，并可随时重导出高清 PNG 与 PDF。
