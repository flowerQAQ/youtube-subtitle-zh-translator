# YouTube Caption ZH Translator

一个 Chromium Manifest V3 扩展：当 YouTube 视频没有简体中文字幕时，读取页面里的 `ytInitialPlayerResponse` / `raw_player_response` 字幕轨，获取可用字幕，并使用 DeepSeek `deepseek-v4-flash` 或 Xiaomi MiMo Token Plan `mimo-v2.5` 翻译成简体中文。

## 开发

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

然后在 Chrome 或 Edge 的扩展管理页加载 WXT 生成的 unpacked extension。

## 构建

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run test
& 'C:\Program Files\nodejs\npm.cmd' run typecheck
& 'C:\Program Files\nodejs\npm.cmd' run build
& 'C:\Program Files\nodejs\npm.cmd' run zip
```

## 配置与调试

点击浏览器工具栏里的扩展图标会打开 popup。基础设置、翻译引擎、API Key 和最近一次字幕加载调试信息都在这里。

- DeepSeek 使用 `https://api.deepseek.com/chat/completions` 和 `deepseek-v4-flash`。
- Xiaomi MiMo 使用 Token Plan `https://token-plan-cn.xiaomimimo.com/v1/chat/completions` 和 `mimo-v2.5`。
- API Key 只保存到 `chrome.storage.local`，不会写入源码或 Git。

## Android Edge 平板使用

第一阶段目标是自用测试 Android Microsoft Edge 平板里的 YouTube 网页版，重点兼容 `https://www.youtube.com/watch*`，同时保留 `https://m.youtube.com/watch*`。

1. 在电脑上运行 `npm run zip` 生成扩展包。
2. 将构建产物传到 Android 平板。
3. 在 Android Microsoft Edge 的扩展入口中安装该扩展。
4. 如果稳定版 Edge 没有本地安装入口，使用 Edge Canary/Dev 自测；仍不可安装时，再考虑 Edge Add-ons 私用或未公开提交。
5. 安装后用 Edge 打开 `https://www.youtube.com/watch?...`。
6. 打开扩展面板，填写 DeepSeek 或 Xiaomi MiMo API Key。
7. 选择显示模式：中文或双语。
8. 刷新 YouTube 视频页并开始播放。
9. 字幕会优先显示已有简体中文字幕；如果没有中文字幕，会选择源字幕轨并按播放窗口懒加载翻译。
10. 如果没有显示字幕，打开 popup 的 debug 区域，检查 `Platform` 是否为 `edge-android-tablet-www`，以及 `Video found`、字幕轨数量、`Timedtext URLs` 和翻译 API 错误。

已知限制：

- 只支持 Edge 中的 YouTube 网页版，不支持 YouTube 原生 App。
- Android Edge 的扩展安装入口可能随版本变化；如果无法本地安装，需要换 Edge Canary/Dev 或后续走 Edge Add-ons。
- 视频本身需要有任意可用字幕轨。

## GitHub

本地 Git 仓库会保存进度；拿到空仓库 URL 后可执行：

```powershell
git remote add origin <your-empty-repo-url>
git push -u origin main
```
