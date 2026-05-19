import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "YouTube 字幕简中翻译",
    description: "Translate available YouTube captions to Simplified Chinese with DeepSeek when Chinese captions are missing.",
    version: "0.1.0",
    permissions: ["storage"],
    host_permissions: [
      "https://www.youtube.com/*",
      "https://m.youtube.com/*",
      "https://api.deepseek.com/*"
    ],
    action: {
      default_title: "YouTube 字幕简中翻译"
    }
  }
});
