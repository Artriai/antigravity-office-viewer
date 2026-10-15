# Antigravity Office Viewer

在 Google Antigravity 编辑区内直接预览 Word、Excel 和 PowerPoint 文档。

**简体中文** · [English](README.en.md)

面向 Windows 的非官方集成工具，专注于文档阅读，内置预览资源，后台服务随 Antigravity 自动启动。

[效果展示](#效果展示) · [功能特性](#功能特性) · [安装使用](#安装使用) · [常见问题](#常见问题) · [卸载方法](#卸载方法) · [开发说明](#开发说明)

## 效果展示

| Word · `.docx` | Excel · `.xlsx` | PowerPoint · `.pptx` |
| --- | --- | --- |
| [![Word 文档预览](screenshots/word_preview.png)](screenshots/word_preview.png) | [![Excel 表格预览](screenshots/excel_preview.png)](screenshots/excel_preview.png) | [![PowerPoint 演示文稿预览](screenshots/ppt_preview.png)](screenshots/ppt_preview.png) |

点击图片查看大图。

## 功能特性

- **编辑区内预览**：直接阅读 Office 文档，避免以文本形式看到 `PK...` 二进制乱码。
- **专注阅读**：隐藏编辑工具栏和无关控件；PowerPoint 采用纵向连续浏览布局。
- **多文档切换**：复用各个已打开文档的预览框架，保留浏览状态，减少重复渲染。
- **自动启动**：通过 `winmm.dll` 代理加载器启动 Node.js 服务，无需修改 `Antigravity.exe`。

主要预览格式为 `.docx`、`.xlsx` 和 `.pptx`。代码还会识别 `.dotx`、`.xlsm`、`.xls`、`.csv`、`.tsv`、`.ods`、`.ppt` 和 `.pptm`，但识别扩展名不代表保证渲染兼容。实际排版效果取决于内置渲染器及文档内容。

## 安装使用

### 环境要求

- **Windows x64**，并已安装 Google Antigravity。仓库附带的 DLL 为 x64，暂未提供 macOS、Linux 安装方案。
- **Node.js 22 或更高版本**，且 `node` 已加入 `PATH`。服务依赖 Node.js 的[内置 WebSocket API](https://nodejs.org/docs/latest/api/globals.html#websocket)。
- Antigravity 需提供可访问的本机 **CDP 调试端口**。服务会自动发现已有端口，但不会自行开启远程调试。

在新终端中检查：

```powershell
node --version
node -p "typeof WebSocket"
```

第二条命令应输出 `function`。

### 安装并打开文档

1. [下载仓库 ZIP](https://github.com/Artriai/antigravity-office-viewer/archive/refs/heads/main.zip) 并解压，或执行：

   ```sh
   git clone https://github.com/Artriai/antigravity-office-viewer.git
   ```

2. 完全退出 Antigravity。如果安装目录内已有其他工具的 `winmm.dll`，请先备份并移走；安装脚本遇到不匹配的 DLL 会停止，避免覆盖。
3. 双击 **`start.bat`**。脚本会通过运行进程、注册表或默认路径定位安装目录；识别失败时，按提示提供安装文件夹或 `Antigravity.exe` 的路径。
4. 正常启动 Antigravity，打开 `.docx`、`.xlsx` 或 `.pptx` 文件，等待数秒让后台服务完成连接。

脚本会将 `winmm.dll` 复制到 `Antigravity.exe` 所在目录，并将 `index.js`、`package.json`、`lib/`、`webview/` 和 `manage.bat` 部署到其下的 `office-viewer/` 文件夹。默认安装路径为 `%LOCALAPPDATA%\Programs\antigravity\`。

**无需执行 `npm install`**：服务使用 Node.js 内置模块，仓库也已包含预览资源。更新时，先退出 Antigravity 并停止预览服务，再运行新版仓库中的 `start.bat`。安装脚本会检查 Node.js 和资源复制结果，更新失败时尝试恢复旧版本。

## 常见问题

| 现象 | 排查方法 |
| --- | --- |
| 打开文档仍显示 `PK...` 乱码 | 检查 `winmm.dll` 和 `office-viewer/` 是否位于 `Antigravity.exe` 所在目录，然后完全重启 Antigravity。 |
| 没有出现预览 | 检查 `node` 是否在 `PATH` 中，且 `typeof WebSocket` 输出 `function`；手动启动服务查看日志。 |
| 没有 `Discovered CDP port` 或 `Attached to` 日志 | 确认 Antigravity 已提供可访问的本机 CDP 端口；服务只连接属于 Antigravity 进程的端口，并检查页面是否包含编辑区。 |
| 出现 `EADDRINUSE` | 默认预览端口 `12399` 被占用，新版服务会复用已有实例；如果仍报错，检查是否有旧版服务或其他程序占用该端口。 |
| 预览空白或提示 `webview directory not found` | 检查 `office-viewer/webview/index.html` 及 `assets/` 目录是否完整复制。 |
| 安装时提示 DLL 复制失败 | 关闭所有 Antigravity 进程后重新运行 `start.bat`。 |
| Antigravity 更新后失效 | 检查部署文件，必要时重新安装；编辑器界面或 CDP 发生变化时，也可能需要更新集成代码。 |

需要查看日志时，先停止已有预览服务，在仓库目录打开终端并执行：

```sh
node index.js
```

测试期间保持终端开启，按 `Ctrl+C` 停止。日志会显示预览资源目录、HTTP 监听地址、发现的 CDP 端口及连接的页面。预览服务默认监听 `127.0.0.1:12399`，可通过服务进程的环境变量 `OFFICE_VIEWER_PORT` 更改端口。

服务运行时，可在仓库目录或已部署的 `office-viewer/` 目录中执行：

```sh
node index.js --status
node index.js --stop
```

也可双击部署目录中的 `manage.bat` 查看状态，或运行 `manage.bat stop` 停止服务。`--daemon` 模式会在 Antigravity 退出约 30 秒后自动停止；手动运行的前台服务会继续等待应用重启。首次从旧版升级时，旧服务不支持 `--stop`，可由安装脚本停止对应进程。

如需限定调试端口，可设置 `OFFICE_VIEWER_CDP_PORT`；指定端口仍须属于 Antigravity 进程。文件找不到时会直接报错，不再尝试打开其他目录下的同名文件。

## 卸载方法

1. 退出 Antigravity，执行 `node index.js --stop` 停止预览服务。旧版服务需按命令行中的 `office-viewer\index.js` 识别并停止，保留其他 Node.js 进程。
2. 在 Antigravity 安装目录中删除本项目安装的 `winmm.dll` 和 `office-viewer/` 文件夹。如果安装前备份过其他 DLL，将其恢复。
3. 正常启动 Antigravity。

## 开发说明

| 路径 | 用途 |
| --- | --- |
| `start.bat` / `scripts/install.ps1` | 检查环境、定位 Antigravity，并验证安装和更新结果 |
| `manage.bat` | 查询或停止已部署的服务 |
| `lib/` | 文件路径解析、CDP 连接及服务管理 |
| `test/` | HTTP、路径、注入、服务生命周期和 Windows 安装回归测试 |
| `index.js` | 本机 HTTP 服务、CDP 端口发现与预览界面集成 |
| `bin/winmm.dll` | 预编译的 Windows x64 代理加载器 |
| `src/loader/` | 加载器 C 源码、导出定义和编译脚本 |
| `webview/` | 内置文档渲染器资源 |
| `screenshots/` | README 使用的预览截图 |

如需重新编译加载器，在 Windows 上将 x64 MinGW-w64 GCC 工具链加入 `PATH`，然后运行 `src\loader\build_dll.bat`，输出为 `bin\winmm.dll`。`webview/` 为已编译的前端资源，仓库目前未包含前端源码构建流程。

执行 `npm test` 运行回归测试。GitHub Actions 在 Windows 和 Linux 的 Node.js 22、24 环境中运行检查，Windows 安装测试仅在 Windows 执行。

## 致谢

文档预览集成使用了 **vscode-office**（`cweijan.vscode-office`）的 webview 资源，感谢上游项目及贡献者。

## 许可证

MIT License © 2026 [Artriai](https://github.com/Artriai)
