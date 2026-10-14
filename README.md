# Antigravity Office Viewer

Seamless Word (`.docx`), Excel (`.xlsx`), and PowerPoint (`.pptx`) document preview for Google Antigravity.

[English](#english) | [中文说明](#中文说明)

---

<a name="english"></a>
## English

Antigravity natively opens Office files (`.docx`, `.xlsx`, `.pptx`) as binary text files, showing raw `PK...` mojibake. **Antigravity Office Viewer** provides a native, beautiful, and zero-configuration office preview panel directly inside the editor pane.

### Screenshots

#### Word (`.docx`)
![Word Preview](screenshots/word_preview.png)

#### Excel (`.xlsx`)
![Excel Preview](screenshots/excel_preview.png)

#### PowerPoint (`.pptx`)
![PowerPoint Preview](screenshots/ppt_preview.png)

### Features

- **Native Office Preview**: High-fidelity rendering for Word (`.docx`), Excel (`.xlsx`), and PowerPoint (`.pptx`).
- **Clean Reading View**: Strips away distracting edit toolbars, banners, and redundant controls for a focused document experience.
- **Instant Multi-Tab Switching**: Independent render pool preserves scroll state and allows 0ms instant tab switching.
- **Non-Invasive & Safe**: Uses a standard `winmm.dll` proxy forwarder to silently launch the background viewer service when Antigravity opens. Zero modifications to Antigravity core executables.

### Quick Install

1. Clone or download this repository.
2. Double-click **`start.bat`**.
   > It automatically copies `winmm.dll` and the viewer service into `%LOCALAPPDATA%\Programs\antigravity\`.
3. Restart **Antigravity**. You're all set!

---

<a name="中文说明"></a>
## 中文说明

Google Antigravity 默认会将 Office 文件（`.docx` / `.xlsx` / `.pptx`）以纯文本打开，导致显示为 `PK...` 二进制乱码。**Antigravity Office Viewer** 通过无感扩展架构，在 Antigravity 主编辑区内直接提供高保真文档预览。

### 效果展示

#### Word (`.docx`) 预览
![Word Preview](screenshots/word_preview.png)

#### Excel (`.xlsx`) 预览
![Excel Preview](screenshots/excel_preview.png)

#### PowerPoint (`.pptx`) 预览
![PowerPoint Preview](screenshots/ppt_preview.png)

### 核心特性

- **原生 Office 渲染**：完美支持 Word、Excel、PPT 渲染与多标签页共存。
- **纯净阅读体验**：自动过滤编辑工具栏、浮动横幅与无关按钮，呈现整洁排版。
- **0ms 无感切页**：多文档独立渲染池，切换即刻响应并保留各文档浏览位置。
- **安全非侵入**：采用系统级 `winmm.dll` 代理转发机制，随 Antigravity 启动静默拉起后台服务，不篡改原版核心安装包。

### 一键安装

1. 克隆或下载本仓库；
2. 双击运行 **`start.bat`**；
   > 脚本将自动将代理 DLL 与渲染模块部署至 `%LOCALAPPDATA%\Programs\antigravity\`。
3. 重新打开 **Antigravity** 即可体验！

---

## License

MIT License © 2026 [Artriai](https://github.com/Artriai)
