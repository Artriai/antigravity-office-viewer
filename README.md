# Antigravity Office Viewer 📄📊📽️

Google Antigravity 原生 Office (Word / Excel / PowerPoint) 文档预览扩展。无需手动开命令窗口，通过 **Proxy DLL 静默加载 + CDP 原生挂载** 实现即放即用。

---

## 📸 预览截图 (Screenshots)

### Word (`.docx`) 预览
> 纯净正文排版，保留标题、段落、表格与样式，移除编辑工具栏。

![Word Preview](screenshots/word_preview.png)

---

### Excel (`.xlsx`) 预览
> 支持多工作表（Sheet Tabs）切换，高保真网格，移除公式栏与只读警告横幅。

![Excel Preview](screenshots/excel_preview.png)

---

### PowerPoint (`.pptx`) 预览
> 纯白背景（`#ffffff`），1440×810 高清画质，自上而下瀑布流连续排布，移除侧边栏。

![PPT Preview](screenshots/ppt_preview.png)

---

## ⚡ 一键安装 (Quick Install)

1. 克隆或下载本仓库；
2. 双击运行 **`start.bat`**；
   > 脚本会自动将 DLL 加载器及渲染引擎完整部署至 Antigravity 目录（`%LOCALAPPDATA%\Programs\antigravity\`）。
3. 重新打开 Antigravity 即可！
   > 启动时由系统底层通过 `winmm.dll` 自动静默拉起后台服务，无黑框、全无感。

---

## ✨ 核心特性 (Features)

- **Word / Excel / PPT 原生预览**：解决打开即为 `PK...` 二进制乱码的痛点，直接在右侧主编辑区呈现高保真渲染；
- **纯净阅读视图**：自动剔除原编辑器的修改工具栏、暗色切换按钮、只读黄色横幅与赞助标语；
- **0ms 无感切页**：底层独立 iframe 渲染池，多文档切换无需重新加载，保留滚动进度；
- **安全非侵入**：不修改 Antigravity 原版 `.exe` 与核心安装包，`winmm.dll` 完美透传 180+ 原生 API 至 `System32\winmm.dll`。

---

## 🛠️ 自行编译 DLL (Optional)

```bash
cd src/loader
build_dll.bat
```
*(需安装 MinGW GCC，编译产物输出至 `bin/winmm.dll`)*

---

## 📜 协议 (License)

MIT License © 2026 [Artriai](https://github.com/Artriai)
