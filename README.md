# 歌词识别

从人声音频中识别歌词的桌面应用。支持本地（whisper.cpp）和云端（OpenAI Whisper API）两种推理方式。

## 功能

- **音频播放** — 支持 MP3、WAV、FLAC、AAC、OGG、M4A 等常见格式
- **波形可视化** — 实时显示音频波形，辅助定位歌词位置
- **VAD 静音检测** — 自动识别人声段落
- **本地推理** — 基于 whisper.cpp，离线可用，支持 tiny/base/small/medium 模型
- **云端推理** — 基于 OpenAI Whisper API，识别精度更高
- **歌词编辑** — 对识别结果逐句编辑和时间戳调整
- **LRC 导出** — 导出标准 LRC 歌词文件
- **历史记录** — 保存识别历史，随时回顾

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 构建 | Vite 5 + vite-plugin-electron |
| 桌面 | Electron 28 |
| 本地推理 | whisper.cpp (GGML) |
| 音频处理 | ffmpeg |
| 测试 | Vitest + Playwright |

## 快速开始

### 环境要求

- Node.js 18+
- ffmpeg（系统安装，或由 ffmpeg-static 自动提供）

### 开发

```bash
# 安装依赖
npm install

# 下载 whisper.cpp 可执行文件到 resources/ 目录
# 参见 resources/README.md

# 启动开发服务器
npm run dev
```

### 打包

```bash
# 仅打包目录（调试用）
npm run pack

# 打包为可分发的安装包
npm run dist
```

打包产物位于 `release/` 目录：

| 平台 | 格式 |
|------|------|
| Linux | AppImage、deb |
| macOS | DMG、zip |
| Windows | NSIS 安装包、portable |

## 项目结构

```
├── electron/            # Electron 主进程
│   ├── main.ts          # 应用入口、窗口管理
│   ├── preload.ts       # preload 脚本（contextBridge）
│   ├── ipc-handlers.ts  # IPC 通信处理
│   ├── audio-manager.ts # 音频格式转换、波形提取、VAD
│   ├── model-manager.ts # 模型下载、本地/云端推理
│   └── export-manager.ts# LRC 导出
├── src/                 # React 渲染进程
│   ├── components/      # UI 组件
│   ├── hooks/           # 自定义 Hooks
│   ├── types/           # TypeScript 类型定义
│   └── utils/           # 工具函数（LRC 解析/格式化）
├── resources/           # 打包资源（whisper 二进制、.so 库、图标）
├── electron-builder.yml # electron-builder 打包配置
└── package.json
```

## 模型管理

本地推理使用 whisper.cpp GGML 模型，首次使用时会自动下载到用户数据目录。支持的模型：

| 模型 | 大小 | 适合场景 |
|------|------|---------|
| tiny | ~75MB | 快速测试 |
| base | ~140MB | 简单英文 |
| small | ~460MB | 中英文日常使用 |
| medium | ~1.4GB | 最高本地精度 |

## 许可证

MIT
