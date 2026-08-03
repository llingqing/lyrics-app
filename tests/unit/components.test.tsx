import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import ConfigPanel from '../../src/components/ConfigPanel'
import AudioPlayer from '../../src/components/AudioPlayer'
import TimelineView from '../../src/components/LyricsResult/TimelineView'
import LyricsEditor from '../../src/components/LyricsResult/LyricsEditor'
import { getMockElectronAPI } from '../setup'

let mockAPI: ReturnType<typeof getMockElectronAPI>

beforeEach(() => {
  mockAPI = getMockElectronAPI()
  vi.stubGlobal('electronAPI', mockAPI)
})

// ─── ConfigPanel ───────────────────────────────────────────

describe('ConfigPanel', () => {
  const audioInfo = {
    filePath: '/tmp/test.wav',
    fileName: 'test.wav',
    duration: 180,
    sampleRate: 16000,
    format: 'wav' as const,
  }

  it('renders engine selection buttons', async () => {
    await act(async () => {
      render(<ConfigPanel audioInfo={audioInfo} onStart={vi.fn()} onBack={vi.fn()} />)
    })
    expect(screen.getByText('🖥️ 本地模型')).toBeDefined()
    expect(screen.getByText('☁️ 云端 API')).toBeDefined()
  })

  it('renders model selection when local engine is selected', async () => {
    await act(async () => {
      render(<ConfigPanel audioInfo={audioInfo} onStart={vi.fn()} onBack={vi.fn()} />)
    })
    expect(screen.getByText('Tiny')).toBeDefined()
    expect(screen.getByText('Base')).toBeDefined()
  })

  it('calls onStart with correct config when button clicked', async () => {
    const onStart = vi.fn()
    render(<ConfigPanel audioInfo={audioInfo} onStart={onStart} onBack={vi.fn()} />)
    // listModels resolves asynchronously; wait for button to appear
    await waitFor(() => {
      expect(screen.getByText('开始识别')).toBeDefined()
    })
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

  it('offers the large local models', async () => {
    await act(async () => {
      render(<ConfigPanel audioInfo={audioInfo} onStart={vi.fn()} onBack={vi.fn()} />)
    })
    expect(screen.getByText('Large v3 Turbo')).toBeDefined()
    expect(screen.getByText('Large v3')).toBeDefined()
  })

  it('prefills base URL and model when a cloud provider preset is chosen', async () => {
    await act(async () => {
      render(<ConfigPanel audioInfo={audioInfo} onStart={vi.fn()} onBack={vi.fn()} />)
    })
    fireEvent.click(screen.getByText('☁️ 云端 API'))
    fireEvent.click(screen.getByText('Groq'))

    expect(screen.getByDisplayValue('https://api.groq.com/openai/v1')).toBeDefined()
    expect(screen.getByDisplayValue('whisper-large-v3-turbo')).toBeDefined()
  })

  it('passes third-party endpoint settings through onStart', async () => {
    const onStart = vi.fn()
    render(<ConfigPanel audioInfo={audioInfo} onStart={onStart} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('开始识别')).toBeDefined())

    fireEvent.click(screen.getByText('☁️ 云端 API'))
    fireEvent.click(screen.getByText('自定义'))
    fireEvent.change(screen.getByPlaceholderText('https://api.example.com/v1'), {
      target: { value: 'https://my.api.dev/v1' },
    })
    fireEvent.change(screen.getByPlaceholderText('whisper-1'), {
      target: { value: 'my-whisper' },
    })
    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-secret' } })
    fireEvent.click(screen.getByText('开始识别'))

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: 'cloud',
        cloudApiKey: 'sk-secret',
        cloudBaseUrl: 'https://my.api.dev/v1',
        cloudModel: 'my-whisper',
      })
    )
  })

  it('restores the saved cloud provider settings on next mount (without the key)', async () => {
    const onStart = vi.fn()
    const { unmount } = render(<ConfigPanel audioInfo={audioInfo} onStart={onStart} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('开始识别')).toBeDefined())
    fireEvent.click(screen.getByText('☁️ 云端 API'))
    fireEvent.click(screen.getByText('Groq'))
    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-secret' } })
    fireEvent.click(screen.getByText('开始识别'))
    unmount()

    await act(async () => {
      render(<ConfigPanel audioInfo={audioInfo} onStart={vi.fn()} onBack={vi.fn()} />)
    })
    fireEvent.click(screen.getByText('☁️ 云端 API'))
    // 服务商与端点被记住，API key 不落盘
    expect(screen.getByDisplayValue('https://api.groq.com/openai/v1')).toBeDefined()
    expect(screen.getByDisplayValue('whisper-large-v3-turbo')).toBeDefined()
    expect((screen.getByPlaceholderText('sk-...') as HTMLInputElement).value).toBe('')
  })
})

// ─── AudioPlayer ───────────────────────────────────────────

describe('AudioPlayer', () => {
  it('renders play button and duration', () => {
    const onTimeUpdate = vi.fn()
    render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        waveform={Array(100).fill(0.5)}
        onTimeUpdate={onTimeUpdate}
      />
    )
    // formatTime(120) → "02:00.000"
    expect(screen.getByText('02:00.000')).toBeDefined()
    // starts at zero
    expect(screen.getByText('00:00.000')).toBeDefined()
  })

  it('renders waveform bars container', () => {
    const onTimeUpdate = vi.fn()
    const { container } = render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        waveform={[0.3, 0.5, 0.7]}
        onTimeUpdate={onTimeUpdate}
      />
    )
    const bars = container.querySelectorAll('[style*="height"]')
    expect(bars.length).toBeGreaterThanOrEqual(3)
  })

  it('renders with fallback waveform when none provided', () => {
    const onTimeUpdate = vi.fn()
    const { container } = render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        onTimeUpdate={onTimeUpdate}
      />
    )
    // fallback: 100 random bars
    const bars = container.querySelectorAll('[style*="height"]')
    expect(bars.length).toBe(100)
  })

  it('keeps the same fallback waveform across re-renders', () => {
    const { container } = render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        onTimeUpdate={vi.fn()}
      />
    )
    const heights = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[style*="height"]')).map(
        el => el.style.height,
      )
    const before = heights()

    // timeupdate 触发一次 state 更新重渲染，兜底波形不应重新随机
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { value: 30, writable: true })
    fireEvent.timeUpdate(audio)

    expect(heights()).toEqual(before)
  })

  it('updates the time display and notifies the parent on native timeupdate events', () => {
    const onTimeUpdate = vi.fn()
    const { container } = render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        waveform={[0.5, 0.5]}
        onTimeUpdate={onTimeUpdate}
      />
    )
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { value: 63, writable: true })
    fireEvent.timeUpdate(audio)

    expect(screen.getByText('01:03.000')).toBeDefined()
    expect(onTimeUpdate).toHaveBeenCalledWith(63)
  })
})

// ─── TimelineView ──────────────────────────────────────────

describe('TimelineView', () => {
  const segments = [
    { id: 'seg-0', start: 0, end: 5, text: 'Hello world', confidence: 0.9, edited: false },
    { id: 'seg-1', start: 5, end: 10, text: 'Second line', confidence: 0.85, edited: false },
  ]

  it('renders all segments', () => {
    render(
      <TimelineView
        segments={segments}
        onEdit={vi.fn()}
        onSeek={vi.fn()}
        onReorder={vi.fn()}
      />
    )
    expect(screen.getByText('Hello world')).toBeDefined()
    expect(screen.getByText('Second line')).toBeDefined()
  })

  it('calls onEdit when clicking segment text', () => {
    const onEdit = vi.fn()
    render(
      <TimelineView
        segments={segments}
        onEdit={onEdit}
        onSeek={vi.fn()}
        onReorder={vi.fn()}
      />
    )
    screen.getByText('Hello world').click()
    expect(onEdit).toHaveBeenCalledWith('seg-0')
  })

  it('calls onSeek when clicking timestamp', () => {
    const onSeek = vi.fn()
    render(
      <TimelineView
        segments={segments}
        onEdit={vi.fn()}
        onSeek={onSeek}
        onReorder={vi.fn()}
      />
    )
    screen.getByText('00:00.000').click()
    expect(onSeek).toHaveBeenCalledWith(0)
  })

  it('highlights only the active segment row', () => {
    render(
      <TimelineView
        segments={segments}
        activeSegmentId="seg-1"
        onEdit={vi.fn()}
        onSeek={vi.fn()}
        onReorder={vi.fn()}
      />
    )
    const activeRow = screen.getByText('Second line').closest('[draggable]')!
    const idleRow = screen.getByText('Hello world').closest('[draggable]')!
    expect(activeRow.className).toContain('bg-blue-500/10')
    expect(idleRow.className).not.toContain('bg-blue-500/10')
  })
})

// ─── LyricsEditor ──────────────────────────────────────────

describe('LyricsEditor', () => {
  const segment = {
    id: 'seg-0', start: 1.5, end: 4.5,
    text: 'Hello world', confidence: 0.9, edited: false,
  }

  it('renders with current text in textarea', () => {
    render(<LyricsEditor segment={segment} onSave={vi.fn()} onCancel={vi.fn()} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('Hello world')
  })

  it('calls onSave with segment id and current text', () => {
    const onSave = vi.fn()
    render(<LyricsEditor segment={segment} onSave={onSave} onCancel={vi.fn()} />)
    screen.getByText('保存').click()
    expect(onSave).toHaveBeenCalledWith('seg-0', 'Hello world')
  })

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn()
    render(<LyricsEditor segment={segment} onSave={vi.fn()} onCancel={onCancel} />)
    screen.getByText('取消').click()
    expect(onCancel).toHaveBeenCalled()
  })
})