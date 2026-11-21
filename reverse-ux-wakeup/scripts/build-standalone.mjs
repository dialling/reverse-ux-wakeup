#!/usr/bin/env node
/**
 * 一次性打包生成全部三个真正支持 file:// 双击即玩的单文件内联版 HTML：
 *
 * 输出目标（位于外层 "/Users/a27/Projects/x 黑客松/" 根目录）：
 *   1. ../醒醒分钱了-双击即玩版.html          （view = 'director'：手机壳 + 404寝室上帝导播台全景版）
 *   2. ../醒醒分钱了-4部联机手机同屏版.html    （view = 'quad'：4部真实联机手机并排同屏墙）
 *   3. ../醒醒分钱了-单部手机纯享Demo版.html   （view = 'single'：单部居中手机纯享闭环版）
 *
 * 并自动修正 dist/index.html 中的 file:// 防白屏相对跳转路径。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outerDir = path.resolve(rootDir, '..');
const distIndexHtmlPath = path.join(rootDir, 'dist', 'index.html');

const STANDALONE_VARIANTS = [
  {
    fileName: '醒醒分钱了-双击即玩版.html',
    viewMode: 'director',
    title: '醒醒！分钱了 (Snooze &amp; Lose) — 手机+上帝导播台完整版',
  },
  {
    fileName: '醒醒分钱了-4部联机手机同屏版.html',
    viewMode: 'quad',
    title: '醒醒！分钱了 (Snooze &amp; Lose) — 4部联机手机同屏版',
  },
  {
    fileName: '醒醒分钱了-单部手机纯享Demo版.html',
    viewMode: 'single',
    title: '醒醒！分钱了 (Snooze &amp; Lose) — 单部手机纯享Demo版',
  },
];

async function main() {
  console.log('📦 正在编译 IIFE 内联核心包（用于生成 3 套 file:// 双击即玩 HTML）...');

  const result = await build({
    root: rootDir,
    configFile: false,
    logLevel: 'warn',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      write: false,
      minify: 'esbuild',
      cssCodeSplit: false,
      modulePreload: false,
      assetsInlineLimit: 1024 * 1024,
      rollupOptions: {
        input: path.join(rootDir, 'src', 'main.tsx'),
        output: {
          format: 'iife',
          name: 'SnoozeAndLoseStandaloneApp',
          inlineDynamicImports: true,
        },
      },
    },
  });

  const outputs = Array.isArray(result)
    ? result.flatMap((r) => ('output' in r ? r.output : []))
    : 'output' in result
      ? result.output
      : [];

  const cssParts = [];
  const jsParts = [];

  for (const item of outputs) {
    if (item.type === 'asset' && item.fileName.endsWith('.css')) {
      cssParts.push(String(item.source));
    } else if (item.type === 'chunk' && item.isEntry) {
      jsParts.push(item.code);
    }
  }

  if (jsParts.length === 0) {
    throw new Error('构建失败：未生成 IIFE 入口 JS 代码块');
  }

  const safeCss = cssParts.join('\n').replace(/<\/style/gi, () => '<\\/style');
  const safeJs = jsParts.join('\n').replace(/<\/script/gi, () => '<\\/script');

  for (const variant of STANDALONE_VARIANTS) {
    const outPath = path.join(outerDir, variant.fileName);
    const html = [
      '<!doctype html>',
      '<html lang="zh-CN" class="dark">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />',
      '    <meta name="theme-color" content="#0F172A" />',
      `    <title>${variant.title}</title>`,
      '    <style>',
      safeCss,
      '    </style>',
      '  </head>',
      '  <body class="bg-[#070B14] text-slate-100 antialiased selection:bg-[#FACC15] selection:text-slate-950">',
      '    <div id="root"></div>',
      `    <script>window.__INITIAL_VIEW_MODE__ = ${JSON.stringify(variant.viewMode)};</script>`,
      '    <script>',
      safeJs,
      '    </script>',
      '  </body>',
      '</html>',
      '',
    ].join('\n');

    await fs.writeFile(outPath, html, 'utf8');
    const stat = await fs.stat(outPath);
    console.log(
      `✅ 已生成 [${variant.viewMode}] 单文件版: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`
    );
  }

  try {
    const distHtml = await fs.readFile(distIndexHtmlPath, 'utf8');
    const patchedDistHtml = distHtml.replaceAll(
      '../醒醒分钱了-双击即玩版.html',
      '../../醒醒分钱了-双击即玩版.html'
    );
    await fs.writeFile(distIndexHtmlPath, patchedDistHtml, 'utf8');
    console.log('✅ 已加固 dist/index.html 的 file:// 防白屏自动跳转');
  } catch {
    // ignore if dist/index.html not present yet
  }
}

main().catch((err) => {
  console.error('❌ 单文件版构建失败:', err);
  process.exit(1);
});
