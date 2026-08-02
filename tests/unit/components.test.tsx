import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
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