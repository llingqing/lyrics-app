# 歌词识别

从人声音频中识别歌词的桌面应用。支持本地（whisper.cpp）和云端（OpenAI Whisper API）两种推理方式。

## 功能

- **音频播放** — 支持 MP3、WAV、FLAC、AAC、OGG、M4A 等常见格式，支持拖拽导入
- **真实波形** — 基于 PCM 数据提取真实音频波形，非模拟数据
- **VAD 静音检测** — 自动识别人声段落
- **本地推理** — 基于 whisper.cpp，离线可用，支持 tiny 到 large-v3 六档模型
- **云端推理** — OpenAI 兼容 API，内置 OpenAI / Groq / 硅基流动预设，支持自定义第三方服务
- **歌词编辑** — 逐句编辑，支持撤销/重做（Ctrl+Z / Ctrl+Shift+Z）
- **拖拽排序** — 拖拽调整歌词段落顺序
- **多格式导出** — LRC、SRT、纯文本导出
- **历史记录** — 识别结果自动保存，编辑实时写回，随时回顾

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

### 测试

```bash
# 运行单元测试
npm test

# 运行 E2E 测试
npm run test:e2e
```

## 项目结构

```
├── electron/              # Electron 主进程
│   ├── main.ts            # 应用入口、窗口管理、media:// 协议
│   ├── preload.ts         # preload 脚本（contextBridge）
│   ├── ipc-handlers.ts    # IPC 通信处理
│   ├── audio-manager.ts   # 音频格式转换、真实波形提取、VAD
│   ├── model-manager.ts   # 模型下载、本地/云端推理、SRT 解析
│   └── export-manager.ts  # LRC/SRT/TXT 导出
├── src/                   # React 渲染进程
│   ├── components/        # UI 组件
│   │   ├── AudioPlayer.tsx     # 音频播放器 + 波形可视化
│   │   ├── AudioUploader.tsx   # 拖拽/选择音频导入
│   │   ├── ConfigPanel.tsx     # 模型/引擎/语言配置
│   │   ├── InferenceProgress.tsx # 推理进度条
│   │   ├── LyricsResult/       # 识别结果（时间轴、编辑、导出）
│   │   ├── HistoryPanel.tsx    # 历史记录列表
│   │   ├── ModelManager.tsx    # 模型下载管理
│   │   └── ErrorBoundary.tsx   # 全局错误边界
│   ├── hooks/             # 自定义 Hooks
│   │   ├── useAudio.ts        # 音频加载
│   │   ├── useInference.ts    # 推理状态
│   │   ├── useHistory.ts      # 历史管理
│   │   └── useModels.ts       # 模型管理
│   ├── types/             # TypeScript 类型定义
│   └── utils/             # 工具函数（LRC/SRT 解析、时间格式化）
├── tests/
│   ├── unit/              # 单元测试（format、lrc、export、components）
│   └── e2e/               # Playwright E2E 测试
├── resources/             # 打包资源（whisper 二进制、.so 库、图标）
├── electron-builder.yml   # electron-builder 打包配置
└── package.json
```

## 模型管理

whisper.cpp GGML 模型，首次使用时会自动下载到用户数据目录。支持的模型：

| 模型 | 大小 | 适合场景 |
|------|------|---------|
| tiny | ~75MB | 快速测试 |
| base | ~140MB | 简单英文 |
| small | ~460MB | 中英文日常使用 |
| medium | ~1.4GB | 高本地精度 |
| large-v3-turbo | ~1.6GB | 快且准 |
| large-v3 | ~3.1GB | 最高本地精度 |

## 云端 / 第三方 API

云端引擎走 OpenAI 兼容的 `/audio/transcriptions` 协议，内置 OpenAI、Groq、硅基流动预设，也可通过「自定义」填入任意兼容服务的 API 地址和模型名。服务商与端点设置会记住上次的选择（API Key 不落盘，每次需重新输入）。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Z | 撤销歌词编辑 |
| Ctrl+Shift+Z | 重做歌词编辑 |

## 错误处理

- **渲染层**：`ErrorBoundary` 组件捕获 React 渲染异常，显示友好提示和重试按钮
- **主进程**：关键操作前检查文件是否存在，返回中文错误信息
- **IPC 层**：根据错误类型返回分类错误码（`FILE_NOT_FOUND`、`CANCELLED` 等）

## 许可证

MIT