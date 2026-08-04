import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../../src/App'
import { getMockElectronAPI } from '../setup'

let api: ReturnType<typeof getMockElectronAPI>

beforeEach(() => {
  api = getMockElectronAPI()
  vi.stubGlobal('electronAPI', api)
})

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
