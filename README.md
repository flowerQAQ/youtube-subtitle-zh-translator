# YouTube 字幕简中翻译

一个 Chromium Manifest V3 插件：当 YouTube 视频没有简体中文字幕时，读取页面里的 `ytInitialPlayerResponse` / `raw_player_response` 字幕轨，获取可用字幕，并使用 DeepSeek `deepseek-v4-flash` 或 Xiaomi MiMo Token Plan `mimo-v2.5` 翻译成简体中文。

## 开发

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

然后在 Chrome 扩展管理页加载 WXT 生成的 unpacked extension。

## 配置与调试

点击浏览器工具栏里的扩展图标会打开 popup。基础设置、翻译引擎、API Key 和最近一次字幕加载调试信息都在这里。

- DeepSeek 使用 `https://api.deepseek.com/chat/completions` 与 `deepseek-v4-flash`。
- Xiaomi MiMo 使用 Token Plan `https://token-plan-cn.xiaomimimo.com/v1/chat/completions` 与 `mimo-v2.5`。
- API Key 只保存到 `chrome.storage.local`，不会写入源码或 Git。

## GitHub

当前环境没有可用的 GitHub 仓库创建工具，且未安装 `gh` CLI。本地 Git 仓库会先保存进度；拿到空仓库 URL 后可执行：

```powershell
git remote add origin <your-empty-repo-url>
git push -u origin main
```
