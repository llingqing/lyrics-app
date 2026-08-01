export interface AudioInfo {
  filePath: string
  fileName: string
  duration: number      // 秒
  sampleRate: number
  format: string
  waveform?: number[]   // 归一化振幅数组 [-1, 1]，长度约 200
  originalPath?: string // 原始文件路径（用于播放，filePath 会被替换为 WAV）
}

export interface LyricSegment {
  id: string
  start: number         // 秒
  end: number           // 秒
  text: string
  confidence: number    // 0-1
  edited: boolean
}

export interface TranscriptionResult {
  id: string
  audioFileName: string
  modelName: string
  engine: 'local' | 'cloud'
  language: string
  segments: LyricSegment[]
  createdAt: string     // ISO 8601
}

export interface InferenceConfig {
  filePath: string
  modelName: 'tiny' | 'base' | 'small' | 'medium'
  engine: 'local' | 'cloud'
  language: 'auto' | 'zh' | 'en' | 'ja' | 'ko'
  cloudApiKey?: string
}

export interface InferenceProgress {
  percent: number            // 0-100
  currentSegment: number     // 当前处理第几段
  totalSegments: number      // 总共几段
  partialText: string        // 已完成部分的文本
  engine?: 'local' | 'cloud' // 推理引擎
}

export type AppStep = 'upload' | 'config' | 'inference' | 'result'

export interface AppState {
  step: AppStep
  audioInfo: AudioInfo | null
  config: InferenceConfig | null
  progress: InferenceProgress | null
  result: TranscriptionResult | null
  error: string | null
  history: TranscriptionResult[]
}

export interface ElectronAPI {
  platform: string
  selectAudio: () => Promise<string | null>
  loadAudio: (filePath: string) => Promise<AudioInfo>
  startInference: (config: InferenceConfig) => Promise<void>
  cancelInference: () => Promise<void>
  retryInference: () => Promise<void>
  saveResult: (result: TranscriptionResult) => Promise<void>
  exportFile: (format: 'txt' | 'lrc' | 'srt', content: string) => Promise<string | null>
  loadHistory: () => Promise<TranscriptionResult[]>
  deleteHistory: (id: string) => Promise<void>
  onInferenceProgress: (callback: (progress: InferenceProgress) => void) => () => void
  onInferenceResult: (callback: (result: TranscriptionResult) => void) => () => void
  onInferenceError: (callback: (error: { message: string; code: string }) => void) => () => void
  listModels: () => Promise<Record<string, boolean>>
  downloadModel: (modelName: string) => Promise<string>
  onModelDownloadProgress: (callback: (p: { modelName: string; percent: number }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
