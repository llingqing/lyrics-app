# 歌词识别桌面应用 — 设计文档

## 概述

一款跨平台（Windows / macOS / Linux）桌面应用，从人声音频中识别/转写歌词，
输出纯文本和时间戳歌词（LRC 格式）。支持本地模型和云端 API 混合方案。

## 用户故事

1. **普通用户** — 手头有歌曲文件但没有歌词，导入应用即可得到歌词文本和同步 LRC
2. **音乐创作者** — 录制的人声 demo 需要转录为文字，支持手动编辑修正后导出

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron（跨平台） |
| 前端 | React + TypeScript |
| 样式 | Tailwind CSS |
| 本地 AI 推理 | whisper.cpp（C++ 子进程） |
| 音频解码 | ffmpeg（ffmpeg-static 捆绑） |
| 云端 AI | OpenAI Whisper API / 阿里云语音识别 |
| 构建 | electron-builder |
| 测试 | Vitest + React Testing Library + Playwright |

## 架构

```
┌─────────────────────────────────────────────────┐
│                  Electron App                    │
│  ┌───────────────────────────────────────────┐  │
│  │            Main Process (Node.js)          │  │
│  │                                           │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  │  │
│  │  │ Audio    │  │ Model    │  │ Export   │  │  │
│  │  │ Manager  │  │ Manager  │  │ Manager  │  │  │
│  │  │(decode,  │  │(whisper. │  │(txt,lrc) │  │  │
│  │  │ split)   │  │ cpp subp)│  │          │  │  │
│  │  └─────────┘  └──────────┘  └─────────┘  │  │
│  │                                           │  │
│  │  ┌──────────────────────────────────┐     │  │
│  │  │         IPC Bridge                │     │  │
│  │  └──────────────────────────────────┘     │  │
│  └───────────────────────────────────────────┘  │
│                      │ IPC                       │
│  ┌───────────────────────────────────────────┐  │
│  │          Renderer Process (React)          │  │
│  │                                           │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │ Upload  │ │ Progress │ │  Result     │ │  │
│  │  │ Audio   │ │ & Status │ │  Lyrics     │ │  │
│  │  │ Page    │ │ Page     │ │  Page       │ │  │
│  │  └─────────┘ └──────────┘ └────────────┘ │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**进程职责：**

| 进程 | 职责 |
|------|------|
| Main Process | 音频解码/预处理、调用 whisper.cpp 子进程做推理、模型下载管理、文件读写、窗口管理 |
| Renderer Process | React UI：文件拖拽上传、推理进度展示、歌词结果展示与编辑、格式导出 |
| whisper.cpp 子进程 | 独立的 C++ 可执行文件，通过命令行参数或 stdin/stdout 通信 |

whisper.cpp 作为独立子进程运行，崩溃不影响主应用，模型版本升级时替换二进制即可。

## 核心流程

```
用户拖入/选择音频文件
        │
        ▼
┌─────────────────┐
│  1. 音频加载     │  ffmpeg 解码为 16kHz mono WAV
│                  │  显示音频波形/时长
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. 配置选择     │  选择模型大小 (tiny/base/small/medium)
│                  │  选择引擎 (本地 / 云端 API)
│                  │  选择输出语言 (自动检测 / 指定)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. 推理执行     │  本地：whisper.cpp 子进程逐段推理
│                  │  云端：流式发送到 API
│                  │  实时回传进度和中间结果
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. 结果展示     │  按时间轴展示每句歌词
│                  │  支持手动编辑修正
│                  │  纯文本 / LRC 双模式预览
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. 导出        │  复制文本 / 导出 .txt / 导出 .lrc
│                  │  保存识别历史
└─────────────────┘
```

### 关键设计决策

- **音频预处理**：统一转成 16kHz mono WAV（Whisper 标准输入），借助 ffmpeg-static 无需用户安装额外依赖
- **模型下载**：首次使用时从 Hugging Face 下载 GGML 模型文件，缓存到用户数据目录。tiny ~150MB, base ~290MB, small ~950MB
- **长音频分段**：Whisper 有约 30 秒上下文窗口，长音频先做 VAD（语音活动检测）切分为含有人声的片段，每段送入模型，最后合并时间戳

## 组件树

```
App
├── AudioUploader          // 拖拽区域 / 文件选择，显示文件名、时长、波形缩略图
├── ConfigPanel            // 模型选择、引擎切换、语言设置
├── InferenceProgress      // 进度条、当前处理片段、预估剩余时间
├── LyricsResult
│   ├── TimelineView       // 按时间轴排列的歌词句子列表
│   ├── LyricsEditor       // 单句编辑（点击句子进入编辑模式）
│   └── ExportPanel        // 格式切换预览 + 复制/导出按钮
└── HistoryPanel           // 侧栏：历史识别记录列表
```

## IPC 通道

```
Renderer → Main:
  'audio:select'          打开文件对话框 → 返回文件路径
  'audio:load'            { filePath } → 返回音频信息 { duration, sampleRate, waveform }
  'inference:start'       { filePath, modelName, engine, language }
  'inference:cancel'      取消当前推理
  'lyrics:save'           { id, segments[] }  保存编辑后的歌词
  'export:save'           { format, content }  导出文件对话框

Main → Renderer:
  'inference:progress'    { percent, currentSegment, partialText }
  'inference:result'      { segments: [{ start, end, text }], language }
  'inference:error'       { message, code }
  'model:download-status' { modelName, percent }
  'audio:info'            { duration, sampleRate, waveform, format }
```

## 数据结构

```typescript
interface AudioInfo {
  filePath: string;
  fileName: string;
  duration: number;      // 秒
  sampleRate: number;
  format: string;
  waveform?: number[];   // 归一化后的波形数据，用于缩略图
}

interface LyricSegment {
  id: string;
  start: number;         // 秒
  end: number;           // 秒
  text: string;
  confidence: number;    // 0-1
  edited: boolean;       // 是否被用户手动编辑过
}

interface TranscriptionResult {
  id: string;
  audioFileName: string;
  modelName: string;
  engine: 'local' | 'cloud';
  language: string;
  segments: LyricSegment[];
  createdAt: string;
}
```

## 错误处理

| 错误类型 | 处理策略 |
|---------|---------|
| 文件格式不支持 | 前端拦截 + 提示 |
| ffmpeg 解码失败 | 显示错误，建议转码 |
| 模型未下载 | 自动触发下载流程 |
| 推理超时/崩溃 | 保留已完成片段，支持断点续推 |
| 云端 API 调用失败 | 重试 3 次，失败后建议切换本地 |
| GPU 内存不足(本地) | 提示换更小的模型 |
| 磁盘空间不足 | 导出/下载前预检 |
| 纯器乐无人声 | 检测后提示"未检测到人声" |

- 所有错误统一通过 IPC `inference:error` 通道发送到渲染进程
- 渲染进程通过 Toast 通知 + 内联提示两种方式展示

## 测试策略

| 层级 | 工具 | 覆盖重点 |
|------|------|---------|
| IPC 通信 | Vitest + 模拟 IPC | 主进程各模块单元测试，mock whisper.cpp 子进程 |
| React 组件 | Vitest + React Testing Library | 组件渲染、用户交互、状态流转 |
| 音频处理 | 真实音频文件集成测试 | ffmpeg 解码、分段逻辑、波形提取 |
| E2E | Playwright | 完整流程：上传 → 配置 → 推理 → 编辑 → 导出 |
| whisper.cpp | 手动回归 | 固定音频文件对比输出结果，模型版本升级时跑 |

## 平面文件结构

```
lyrics-app/
├── electron/              # Electron 主进程
│   ├── main.ts
│   ├── preload.ts
│   ├── audio-manager.ts   # ffmpeg 调用、VAD 分段
│   ├── model-manager.ts   # whisper.cpp 子进程管理、模型下载
│   ├── export-manager.ts  # 歌词导出 (txt, lrc)
│   └── ipc-handlers.ts   # IPC 通道注册
├── src/                   # React 渲染进程
│   ├── App.tsx
│   ├── components/
│   │   ├── AudioUploader.tsx
│   │   ├── ConfigPanel.tsx
│   │   ├── InferenceProgress.tsx
│   │   ├── LyricsResult/
│   │   │   ├── TimelineView.tsx
│   │   │   ├── LyricsEditor.tsx
│   │   │   └── ExportPanel.tsx
│   │   └── HistoryPanel.tsx
│   ├── hooks/             # 自定义 hooks
│   ├── types/             # TypeScript 类型定义
│   └── utils/             # 格式化、LRC 解析等工具函数
├── resources/             # 模型文件存放、whisper.cpp 二进制
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
└── tailwind.config.js
```
