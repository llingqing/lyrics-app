import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../../src/App'
import { getMockElectronAPI } from '../setup'
import { TranscriptionResult } from '../../src/types'

let api: ReturnType<typeof getMockElectronAPI>

beforeEach(() => {
  api = getMockElectronAPI()
  vi.stubGlobal('electronAPI', api)
})

function makeHistoryEntry(overrides: Partial<TranscriptionResult> = {}): TranscriptionResult {
  return {
    id: 'h1',
    audioFileName: 'old.mp3',
    modelName: 'base',
    engine: 'local',
    language: 'zh',
    createdAt: '2026-01-01T00:00:00.000Z',
    segments: [{ id: 'seg-0', start: 0, end: 5, text: '旧的一句', confidence: 0.9, edited: false }],
    ...overrides,
  }
}

describe('App restart during inference', () => {
  it('cancels a running inference when 重新开始 is clicked', async () => {
    api.selectAudio.mockResolvedValue('/tmp/current.mp3')
    api.loadAudio.mockResolvedValue({
      filePath: '/tmp/current.wav',
      fileName: 'current.mp3',
      duration: 60,
      sampleRate: 16000,
      format: 'mp3',
      originalPath: '/tmp/current.mp3',
    })
    api.startInference.mockReturnValue(new Promise(() => {})) // 挂起，保持推理进行中

    render(<App />)
    await screen.findByText('暂无历史记录')

    fireEvent.click(screen.getByText('点击选择'))
    await screen.findByText('开始识别')
    fireEvent.click(screen.getByText('开始识别'))
    await waitFor(() => expect(api.startInference).toHaveBeenCalled())

    fireEvent.click(screen.getByText('重新开始'))

    expect(api.cancelInference).toHaveBeenCalled()
  })
})

describe('App history audio restore', () => {
  it('restores the audio player when the entry still points to an existing file', async () => {
    api.loadHistory.mockResolvedValue([makeHistoryEntry({ audioPath: '/music/old.mp3' })])
    api.restoreAudio.mockResolvedValue({
      filePath: '/music/old.mp3',
      fileName: 'old.mp3',
      duration: 60,
      sampleRate: 16000,
      format: 'mp3',
      originalPath: '/music/old.mp3',
    })

    const { container } = render(<App />)
    await screen.findByText('old.mp3')

    fireEvent.click(screen.getByText('old.mp3'))
    await screen.findByText('旧的一句')

    expect(api.restoreAudio).toHaveBeenCalledWith('/music/old.mp3')
    await waitFor(() => expect(container.querySelector('audio')).not.toBeNull())
  })

  it('keeps the player hidden when the audio file is gone', async () => {
    api.loadHistory.mockResolvedValue([makeHistoryEntry({ audioPath: '/music/gone.mp3' })])
    api.restoreAudio.mockResolvedValue(null)

    const { container } = render(<App />)
    await screen.findByText('old.mp3')

    fireEvent.click(screen.getByText('old.mp3'))
    await screen.findByText('旧的一句')

    await waitFor(() => expect(api.restoreAudio).toHaveBeenCalled())
    expect(container.querySelector('audio')).toBeNull()
  })
})
