#!/usr/bin/env node
/**
 * 一次性打包生成：
 *   A. 全部三个支持 file:// 双击直开的单文件内联版 HTML（输出至外层目录）：
 *      1. ../醒醒分钱了-4部联机手机同屏版.html （view = 'quad'）
 *      2. ../醒醒分钱了-单部手机版.html         （view = 'single'）
 *      3. ../醒醒分钱了-寝室总控台版.html       （view = 'director'）
 *   B. 零外部依赖（免 node_modules / 免 npm install）的跨平台局域网联机单文件服务端：
 *      server/lan-standalone-server.cjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transformWithEsbuild } from 'vite';
import * as esbuild from 'esbuild';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

void transformWithEsbuild;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outerDir = path.resolve(rootDir, '..');
const distIndexHtmlPath = path.join(rootDir, 'dist', 'index.html');

const STANDALONE_VARIANTS = [
  {
    fileName: '醒醒分钱了-4部联机手机同屏版.html',
    viewMode: 'quad',
    title: '醒醒！分钱了 Rise & Fine — 404寝室4机实况同屏',
  },
  {
    fileName: '醒醒分钱了-单部手机版.html',
    viewMode: 'single',
    title: '醒醒！分钱了 Rise & Fine — 404寝室个人端',
  },
  {
    fileName: '醒醒分钱了-寝室总控台版.html',
    viewMode: 'director',
    title: '醒醒！分钱了 Rise & Fine — 404寝室契约总控台',
  },
];

async function buildZeroDepLanServer() {
  const serverEntry = path.join(rootDir, 'server', 'lan-standalone-server-src.mjs');
  const serverOut = path.join(rootDir, 'server', 'lan-standalone-server.cjs');

  await esbuild.build({
    entryPoints: [serverEntry],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: serverOut,
    external: ['bufferutil', 'utf-8-validate'],
    banner: {
      js: '/* Rise & Fine (醒醒！分钱了) Zero-Dependency LAN Sync + Static Web Server */',
    },
  });

  const stat = await fs.stat(serverOut);
  console.log(
    `✅ 已生成零依赖局域网服务端: ${serverOut} (${(stat.size / 1024).toFixed(1)} KB)`
  );
}

async function main() {
  console.log('📦 正在编译 Rise & Fine IIFE 内联核心包...');

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
          name: 'RiseAndFineStandaloneApp',
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
    const patchedDistHtml = distHtml
      .replace("? '../../' : '../'", "? '../../../' : '../../'")
      .replaceAll('../醒醒分钱了-寝室总控台版.html', '../../醒醒分钱了-寝室总控台版.html');
    await fs.writeFile(distIndexHtmlPath, patchedDistHtml, 'utf8');
    console.log('✅ 已同步 dist/index.html 的 file:// 相对跳转层级');
  } catch {
    // ignore if dist/index.html not present yet
  }

  await buildZeroDepLanServer();
}

main().catch((err) => {
  console.error('❌ 构建失败:', err);
  process.exit(1);
});
