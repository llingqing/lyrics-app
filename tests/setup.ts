import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// 这个 jsdom 环境没有 localStorage（Electron 渲染进程里有），补一个内存实现；
// 每个测试前清空，避免持久化状态在测试间泄漏
const storageBacking = new Map<string, string>()
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => storageBacking.get(key) ?? null,
      setItem: (key: string, value: string) => { storageBacking.set(key, String(value)) },
      removeItem: (key: string) => { storageBacking.delete(key) },
      clear: () => { storageBacking.clear() },
      key: (i: number) => [...storageBacking.keys()][i] ?? null,
      get length() { return storageBacking.size },
    },
  })
}

beforeEach(() => {
  localStorage.clear()
})

// Complete electronAPI mock for renderer tests — individual suites can
// override specific methods via vi.mocked() after calling getMockElectronAPI().
export function getMockElectronAPI() {
  return {
    platform: 'linux',
    selectAudio: vi.fn(),
    loadAudio: vi.fn(),
    startInference: vi.fn(),
    cancelInference: vi.fn(),
    saveResult: vi.fn(),
    exportFile: vi.fn(),
    loadHistory: vi.fn().mockResolvedValue([]),
    deleteHistory: vi.fn(),
    onInferenceProgress: vi.fn().mockReturnValue(() => {}),
    onInferenceResult: vi.fn().mockReturnValue(() => {}),
    onInferenceError: vi.fn().mockReturnValue(() => {}),
    listModels: vi.fn().mockResolvedValue({ tiny: true, base: true, small: false, medium: false }),
    downloadModel: vi.fn(),
    onModelDownloadProgress: vi.fn().mockReturnValue(() => {}),
  }
}