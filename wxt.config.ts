import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "YouTube Caption ZH Translator",
    description: "Translate available YouTube captions to Simplified Chinese with DeepSeek when Chinese captions are missing.",
    version: "0.1.0",
    permissions: ["storage"],
    host_permissions: [
      "https://www.youtube.com/*",
      "https://m.youtube.com/*",
      "https://api.deepseek.com/*"
    ],
    action: {
      default_title: "YouTube Caption ZH Translator"
    }
  }
});
