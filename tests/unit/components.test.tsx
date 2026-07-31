import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfigPanel from '../../src/components/ConfigPanel'

// Mock window.electronAPI
const mockElectronAPI = {
  platform: 'linux',
  selectAudio: vi.fn(),
  loadAudio: vi.fn(),
  startInference: vi.fn(),
  cancelInference: vi.fn(),
  saveResult: vi.fn(),
  exportFile: vi.fn(),
  loadHistory: vi.fn(),
  deleteHistory: vi.fn(),
  onInferenceProgress: vi.fn().mockReturnValue(() => {}),
  onInferenceResult: vi.fn().mockReturnValue(() => {}),
  onInferenceError: vi.fn().mockReturnValue(() => {}),
}
vi.stubGlobal('electronAPI', mockElectronAPI)

describe('ConfigPanel', () => {
  const audioInfo = {
    filePath: '/tmp/test.wav',
    fileName: 'test.wav',
    duration: 180,
    sampleRate: 16000,
    format: 'wav',
  }

  it('renders engine selection buttons', () => {
    render(
      <ConfigPanel
        audioInfo={audioInfo}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText('🖥️ 本地模型')).toBeDefined()
    expect(screen.getByText('☁️ 云端 API')).toBeDefined()
  })

  it('renders model selection when local engine is selected', () => {
    render(
      <ConfigPanel
        audioInfo={audioInfo}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText('Tiny')).toBeDefined()
    expect(screen.getByText('Base')).toBeDefined()
  })

  it('calls onStart with correct config when button clicked', () => {
    const onStart = vi.fn()
    render(
      <ConfigPanel
        audioInfo={audioInfo}
        onStart={onStart}
        onBack={vi.fn()}
      />
    )
    screen.getByText('开始识别').click()
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/test.wav',
        modelName: 'base',
        engine: 'local',
        language: 'auto',
      })
    )
  })
})
