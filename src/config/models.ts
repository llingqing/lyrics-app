import { LocalModelName } from '../types'

// 本地 whisper.cpp 模型（ConfigPanel 与 ModelManager 共用同一份定义）
export const LOCAL_MODELS: {
  value: LocalModelName
  label: string
  size: string
  desc: string
}[] = [
  { value: 'tiny', label: 'Tiny', size: '150 MB', desc: '最快' },
  { value: 'base', label: 'Base', size: '290 MB', desc: '推荐' },
  { value: 'small', label: 'Small', size: '950 MB', desc: '更准确' },
  { value: 'medium', label: 'Medium', size: '1.5 GB', desc: '高准确' },
  { value: 'large-v3-turbo', label: 'Large v3 Turbo', size: '1.6 GB', desc: '快且准' },
  { value: 'large-v3', label: 'Large v3', size: '3.1 GB', desc: '最准确' },
]

// 云端服务商预设：都走 OpenAI 兼容的 /audio/transcriptions 协议
export interface CloudPreset {
  id: string
  label: string
  baseUrl: string
  model: string
}

export const CLOUD_PRESETS: CloudPreset[] = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'whisper-1' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
  { id: 'siliconflow', label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'FunAudioLLM/SenseVoiceSmall' },
  { id: 'custom', label: '自定义', baseUrl: '', model: '' },
]

// 记住上次用的云端服务商设置（不含 API key，密钥不落盘）
const CLOUD_SETTINGS_KEY = 'cloud-provider-settings'

export interface CloudSettings {
  presetId: string
  baseUrl: string
  model: string
}

export function loadCloudSettings(): CloudSettings | null {
  try {
    const raw = localStorage.getItem(CLOUD_SETTINGS_KEY)
    return raw ? (JSON.parse(raw) as CloudSettings) : null
  } catch {
    return null
  }
}

export function saveCloudSettings(settings: CloudSettings): void {
  try {
    localStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // localStorage 不可用时静默跳过，只影响下次预填
  }
}
