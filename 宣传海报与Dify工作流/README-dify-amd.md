# 宣传海报与 Dify 工作流说明（Rise & Fine · 醒醒！分钱了）

本目录已按**最终成品 PDF**、**高清 PNG**、**可编辑源码**与**生成溯源证明**分类整理，去除全部重复过程图。

---

## 一、 目录结构与文件说明

```text
宣传海报与Dify工作流/
├── poster-final.pdf                 # 【中文主版】单页满版矢量海报 PDF (900×1350 pt)
├── poster-final-en.pdf              # 【纯英文版】单页满版矢量海报 PDF (900×1350 pt)
├── poster-final-bilingual.pdf       # 【中英双页合订版】矢量海报 PDF (第1页中文 + 第2页英文)
├── dify-amd-poster-workflow.yml     # Dify 3节点海报生成工作流 DSL 模板 (v0.1.5)
├── README-dify-amd.md               # 本说明文件
├── 高清PNG导出图/
│   ├── poster-final.png             # 中文主版高清海报 PNG (2400×3600)
│   └── poster-final-en.png          # 纯英文版高清海报 PNG (2400×3600)
├── 可编辑源文件/
│   ├── poster-editable.html         # 中文主版可自由改字换色 HTML+SVG 源码
│   ├── poster-editable.svg          # 中文主版独立分层纯矢量 SVG 源文件
│   ├── poster-editable-en.html      # 纯英文版可自由编辑 HTML+SVG 源码
│   └── poster-editable-en.svg       # 纯英文版独立分层纯矢量 SVG 源文件
└── 生成溯源与证明留档/
    ├── amd-raw-image-kept.png       # AMD Creative Factory 原始未编辑生成图 (Kept 留档)
    ├── amd-gallery-kept.jpg         # AMD Creative Factory → Image → My work → Gallery 证明截图
    ├── dify-poster-provenance.png   # Dify Cloud 工作流真实运行节点截图
    └── dify-raw-output.html         # Dify 工作流单次运行原始输出代码留档
```

---

## 二、 Dify 工作流导入复现与二次编辑说明

1. **导入 Dify 运行**：在 Dify 工作室点击 **「导入 DSL 文件 (Import DSL file)」** 上传 `dify-amd-poster-workflow.yml`，可直接使用预设 `AMD Free Token Factory` 插件或切换至任意已配置模型供应商点击 `Test Run` 生成结构化海报初稿。
2. **修改海报文字或配色**：用浏览器或代码编辑器打开 `可编辑源文件/poster-editable.html`（或 `poster-editable-en.html`）修改文案后，按 `Cmd+P` / `Ctrl+P` 选择 **「另存为 PDF」**（边距选「无」，勾选「背景图形」）即可重新导出单页满版矢量 PDF；或将 `.svg` 拖入 Figma / Illustrator 分图层编辑。
