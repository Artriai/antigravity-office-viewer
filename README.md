# Antigravity Office Viewer 📄📊📽️

> **Native-like, high-performance Office document (Word, Excel, PowerPoint) preview engine for Google Antigravity IDE.**
>
> 支持 **DLL 纯静默自启（即放即用）** 与 **独立守护进程（脚本运行）** 双模式。

English | [中文说明](#中文说明)

---

## 🌟 Overview

By default, Google Antigravity treats `.docx`, `.xlsx`, and `.pptx` as raw text files, rendering them as binary mojibake (`PK...`). 

**Antigravity Office Viewer** solves this by bridging the industry-standard `vscode-office` rendering engine into Antigravity via the Chrome DevTools Protocol (CDP). It provides instant, native-feeling, read-only visual previews for Word, Excel, and PowerPoint files directly inside the main editor pane.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│               Antigravity Desktop (Electron)           │
│  [winmm.dll (Proxy Loader)]                            │
│    └─ Spawns Office Viewer Daemon silently on boot     │
│  [Editor Pane]                                         │
│    └─ Injected 0ms-cached IFrame Container (CDP Hook)  │
└──────────────────────────▲─────────────────────────────┘
                           │ Chrome DevTools Protocol (CDP)
┌──────────────────────────┴─────────────────────────────┐
│             Office Viewer Daemon (Node.js)             │
│  ├─ Built-in Office Webview Engine (Port 12399)        │
│  ├─ Dynamic CDP Discovery & Attachment                 │
│  └─ Instant Multi-Document IFrame Pool                 │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Features

- 📄 **Word (`.docx`, `.dotx`)**:
  - Full document layout preview (headings, formatted text, tables, embedded images).
  - Pure read-only mode: removes editing toolbars, title bars, and formatting palettes.
- 📊 **Excel (`.xlsx`, `.xls`, `.csv`, `.tsv`)**:
  - Multi-sheet tab navigation and high-fidelity spreadsheet grid rendering.
  - Distraction-free: removes formula bars, cell editing handlers, and read-only warning banners.
- 📽️ **PowerPoint (`.pptx`, `.ppt`)**:
  - **Pure White Background (`#ffffff`)**: Clean presentation look.
  - **Continuous Vertical Flow**: Slides are rendered from top to bottom in an infinite-scroll layout.
  - **1440×810 HD Canvas**: Crystal-clear slide deck graphics.
  - **No Sidebars**: Removed redundant thumbnail sidebar to maximize reading area.
- ⚡ **Zero-Latency Tab Switching (0ms)**:
  - Built-in DOM iframe pooling cache. Switching tabs does not reload or re-parse the document.
  - Retains scroll position and viewport state instantly.
- 🛡️ **100% Non-Invasive & Safe**:
  - Zero modifications to Antigravity's official binaries (`.exe`, `.asar`).
  - DLL proxy forwards all 180+ Windows multimedia APIs to `System32\winmm.dll`.
  - Discovers the CDP debugging port dynamically and attaches non-destructively.
  - Fully compliant with Antigravity / VS Code native tab lifecycles (single-click preview, double-click pin).

---

## 🚀 Quick Start

### Method 1: DLL Auto-Load Mode (Recommended - Zero Manual Steps)
Simply copy the precompiled proxy DLL into your Antigravity installation folder:
1. Copy `bin/winmm.dll` into Antigravity's directory:
   ```text
   %LOCALAPPDATA%\Programs\antigravity\
   ```
2. Whenever you start Antigravity, the viewer daemon starts silently in the background. No consoles, no batch files!

### Method 2: Standalone Daemon Mode
If you prefer not using the DLL loader:
```bash
# 1. Clone repository
git clone https://github.com/Artriai/antigravity-office-viewer.git
cd antigravity-office-viewer

# 2. Run daemon
npm start
# or double-click `start.bat` on Windows
```

---

<br/>

<a id="中文说明"></a>
# 中文说明 🇨🇳

**Antigravity Office Viewer** 是为 Google Antigravity IDE 打造的现代化、高保真 Office 文档（Word、Excel、PPT）本地预览方案。

### 痛点与解决
Antigravity 默认会将 `.docx`、`.xlsx`、`.pptx` 等 Office 文档视作普通文本打开，导致直接展示为 OpenXML ZIP 二进制乱码（`PK...`）。

本项目通过 **DLL 劫持自启动加载器 + Chrome DevTools Protocol (CDP)** 无侵入式桥接成熟的 Office 渲染引擎，让 Antigravity 拥有媲美原生桌面应用的文档即时可视化预览体验。

### 运行模式
1. **DLL 静默自启方案（推荐）**：
   - 将 `bin/winmm.dll` 直接丢进 Antigravity 安装目录（`%LOCALAPPDATA%\Programs\antigravity\`）；
   - Antigravity 启动时由系统机制自动加载，后台静默拉起渲染引擎，**完全无需手动运行脚本或批处理**；
   - 内部完美转发全部 180+ 项 Windows 原生 API 至 `System32\winmm.dll`，100% 保证原系统功能零破坏。
2. **独立守护进程模式**：
   - 直接运行 `npm start` 或双击 `start.bat` 亦可独立生效。

### 核心亮点
1. **Word 纯净预览**：完整还原排版、表格、样式与插图，去除多余编辑工具栏。
2. **Excel 表格预览**：支持多工作表 Sheet 切换，高保真表格网格，去除只读提示横幅与公式编辑栏。
3. **PowerPoint 连续流视图**：
   - 全局背景适配纯白（`#ffffff`），告别黑底；
   - 幻灯片采用自上而下连续排列瀑布流；
   - 1440×810 高清画质渲染，移除侧边缩略图栏，视野开阔。
4. **0ms 瞬时无缝切页**：底层维护独立 iframe 渲染池，多文档切换无需重新加载，不闪烁，保留各自滚动进度。
5. **极简安全非侵入**：不破坏 Antigravity 的任何核心安装包与二进制文件，自动动态识别 CDP 端口并静默服务。

---

## 🛠️ 编译 DLL Loader

如果你想自行编译 Proxy DLL 加载器：
```bash
cd src/loader
build_dll.bat
# 依赖 GCC (MinGW-w64)，编译产物位于 bin/winmm.dll
```

---

## 📜 License

MIT License © 2026 [Artriai](https://github.com/Artriai)
