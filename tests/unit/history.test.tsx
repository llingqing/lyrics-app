import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react'
import App from '../../src/App'
import HistoryPanel from '../../src/components/HistoryPanel'
import { useHistory } from '../../src/hooks/useHistory'
import { getMockElectronAPI } from '../setup'
import { TranscriptionResult } from '../../src/types'

function makeResult(overrides: Partial<TranscriptionResult> = {}): TranscriptionResult {
  return {
    id: 'r1',
    audioFileName: 'song.mp3',
    modelName: 'base',
    engine: 'local',
    language: 'zh',
    createdAt: '2026-01-01T00:00:00.000Z',
    segments: [
      { id: 'seg-0', start: 0, end: 5, text: '第一句', confidence: 0.9, edited: false },
      { id: 'seg-1', start: 5, end: 10, text: '第二句', confidence: 0.9, edited: false },
    ],
    ...overrides,
  }
}

let api: ReturnType<typeof getMockElectronAPI>

beforeEach(() => {
  api = getMockElectronAPI()
  vi.stubGlobal('electronAPI', api)
})

describe('useHistory', () => {
  it('loads history on mount', async () => {
    api.loadHistory.mockResolvedValue([makeResult()])
    const { result } = renderHook(() => useHistory())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.history).toHaveLength(1)
  })

  it('saveToHistory prepends a new entry', async () => {
    const { result } = renderHook(() => useHistory())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.saveToHistory(makeResult()))
    expect(api.saveResult).toHaveBeenCalledOnce()
    expect(result.current.history.map(h => h.id)).toEqual(['r1'])
  })

  it('saveToHistory updates an existing entry in place without duplicating', async () => {
    api.loadHistory.mockResolvedValue([
      makeResult({ id: 'r2', audioFileName: 'other.mp3' }),
      makeResult(),
    ])
    const { result } = renderHook(() => useHistory())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.saveToHistory(makeResult({ audioFileName: 'renamed.mp3' })))
    expect(result.current.history.map(h => h.id)).toEqual(['r2', 'r1'])
    expect(result.current.history[1].audioFileName).toBe('renamed.mp3')
  })

  it('keeps state unchanged and sets error when saving fails', async () => {
    api.saveResult.mockRejectedValue(new Error('disk full'))
    const { result } = renderHook(() => useHistory())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.saveToHistory(makeResult()))
    expect(result.current.history).toHaveLength(0)
    expect(result.current.error).toBe('保存历史记录失败')
  })

  it('deleteFromHistory removes the entry', async () => {
    api.loadHistory.mockResolvedValue([makeResult()])
    const { result } = renderHook(() => useHistory())
    await waitFor(() => expect(result.current.history).toHaveLength(1))
    await act(() => result.current.deleteFromHistory('r1'))
    expect(api.deleteHistory).toHaveBeenCalledWith('r1')
    expect(result.current.history).toHaveLength(0)
  })

  it('sets error when loading fails', async () => {
    api.loadHistory.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useHistory())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('历史记录加载失败')
  })
})

describe('HistoryPanel', () => {
  const noop = () => {}

  it('renders entries from props', () => {
    render(
      <HistoryPanel history={[makeResult()]} loading={false} error={null} onSelect={noop} onDelete={noop} />,
    )
    expect(screen.getByText('song.mp3')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<HistoryPanel history={[]} loading error={null} onSelect={noop} onDelete={noop} />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(
      <HistoryPanel history={[]} loading={false} error="保存历史记录失败" onSelect={noop} onDelete={noop} />,
    )
    expect(screen.getByText('保存历史记录失败')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<HistoryPanel history={[]} loading={false} error={null} onSelect={noop} onDelete={noop} />)
    expect(screen.getByText('暂无历史记录')).toBeInTheDocument()
  })

  it('calls onDelete with the entry id', () => {
    const onDelete = vi.fn()
    render(
      <HistoryPanel history={[makeResult()]} loading={false} error={null} onSelect={vi.fn()} onDelete={onDelete} />,
    )
    fireEvent.click(screen.getByText('删除'))
    expect(onDelete).toHaveBeenCalledWith('r1')
  })
})

describe('App auto-save', () => {
  function emitResult(result: TranscriptionResult) {
    const callback = api.onInferenceResult.mock.calls[0][0]
    act(() => callback(result))
  }

  it('saves a finished transcription automatically and shows it in the panel', async () => {
    render(<App />)
    await screen.findByText('暂无历史记录')

    emitResult(makeResult())

    await waitFor(() => expect(api.saveResult).toHaveBeenCalledOnce())
    expect(api.saveResult.mock.calls[0][0].id).toBe('r1')
    expect(screen.getByText('song.mp3')).toBeInTheDocument()
    expect(screen.queryByText('保存到历史')).not.toBeInTheDocument()
  })

  it('re-saves the same entry when lyrics are edited', async () => {
    render(<App />)
    await screen.findByText('暂无历史记录')
    emitResult(makeResult())
    await waitFor(() => expect(api.saveResult).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByText('第一句'))
    // 不用 getByRole('textbox')：历史面板的搜索框也是 textbox，编辑框以预填文本定位
    fireEvent.change(screen.getByDisplayValue('第一句'), { target: { value: '改过的第一句' } })
    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => expect(api.saveResult).toHaveBeenCalledTimes(2))
    const saved = api.saveResult.mock.calls[1][0]
    expect(saved.id).toBe('r1')
    expect(saved.segments[0].text).toBe('改过的第一句')
    expect(screen.getAllByText('song.mp3')).toHaveLength(1)
  })
})

describe('App history select', () => {
  function emitResult(result: TranscriptionResult) {
    const callback = api.onInferenceResult.mock.calls[0][0]
    act(() => callback(result))
  }

  it('drops the previous file audio player when a history entry is selected', async () => {
    api.selectAudio.mockResolvedValue('/tmp/current.mp3')
    api.loadAudio.mockResolvedValue({
      filePath: '/tmp/current.wav',
      fileName: 'current.mp3',
      duration: 60,
      sampleRate: 16000,
      format: 'mp3',
      originalPath: '/tmp/current.mp3',
    })
    api.loadHistory.mockResolvedValue([
      makeResult({
        id: 'old-1',
        audioFileName: 'old.mp3',
        segments: [{ id: 'seg-0', start: 0, end: 5, text: '旧的一句', confidence: 0.9, edited: false }],
      }),
    ])

    const { container } = render(<App />)
    await screen.findByText('old.mp3')

    // 加载音频（audioInfo 设置后上传区卸载），再让识别结果到达 → 播放器出现
    fireEvent.click(screen.getByText('点击选择'))
    await waitFor(() => expect(screen.queryByText('点击选择')).not.toBeInTheDocument())
    emitResult(makeResult())
    await waitFor(() => expect(container.querySelector('audio')).not.toBeNull())

    // 选择另一条历史记录：历史里没存音频路径，不能沿用上一个文件的播放器
    fireEvent.click(screen.getByText('old.mp3'))
    await screen.findByText('旧的一句')
    expect(container.querySelector('audio')).toBeNull()
  })
})
