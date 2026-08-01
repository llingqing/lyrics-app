import '@testing-library/jest-dom'
import { vi } from 'vitest'

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