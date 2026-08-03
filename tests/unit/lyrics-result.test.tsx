import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LyricsResult from '../../src/components/LyricsResult'
import { getMockElectronAPI } from '../setup'
import { TranscriptionResult } from '../../src/types'

beforeEach(() => {
  vi.stubGlobal('electronAPI', getMockElectronAPI())
})

// 每次新建 fixture：组件若原地修改 segment 对象，共享常量会把状态泄漏到下一个测试
function makeFixtureResult(): TranscriptionResult {
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
  }
}

function renderResult(onSegmentsChange = vi.fn()) {
  render(
    <LyricsResult
      result={makeFixtureResult()}
      audioInfo={null}
      onSegmentsChange={onSegmentsChange}
    />
  )
  return onSegmentsChange
}

/** Edits the segment showing `from` so it reads `to`. */
function editSegment(from: string, to: string) {
  fireEvent.click(screen.getByText(from))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: to } })
  fireEvent.click(screen.getByText('保存'))
}

const undoButton = () => screen.getByTitle('撤销 (Ctrl+Z)')
const redoButton = () => screen.getByTitle('重做 (Ctrl+Shift+Z)')

describe('LyricsResult undo/redo', () => {
  it('disables both buttons before any edit', () => {
    renderResult()
    expect(undoButton()).toBeDisabled()
    expect(redoButton()).toBeDisabled()
  })

  it('enables undo after an edit', () => {
    renderResult()
    editSegment('第一句', '改过的第一句')

    expect(screen.getByText('改过的第一句')).toBeDefined()
    expect(undoButton()).not.toBeDisabled()
    expect(redoButton()).toBeDisabled()
  })

  it('restores the previous text on undo', () => {
    renderResult()
    editSegment('第一句', '改过的第一句')
    fireEvent.click(undoButton())

    expect(screen.getByText('第一句')).toBeDefined()
    expect(screen.queryByText('改过的第一句')).toBeNull()
    expect(undoButton()).toBeDisabled()
    expect(redoButton()).not.toBeDisabled()
  })

  it('reapplies the edit on redo', () => {
    renderResult()
    editSegment('第一句', '改过的第一句')
    fireEvent.click(undoButton())
    fireEvent.click(redoButton())

    expect(screen.getByText('改过的第一句')).toBeDefined()
    expect(undoButton()).not.toBeDisabled()
    expect(redoButton()).toBeDisabled()
  })

  it('walks back through two edits in order', () => {
    renderResult()
    editSegment('第一句', 'A')
    editSegment('第二句', 'B')

    fireEvent.click(undoButton())
    expect(screen.getByText('第二句')).toBeDefined()
    expect(screen.getByText('A')).toBeDefined()

    fireEvent.click(undoButton())
    expect(screen.getByText('第一句')).toBeDefined()
    expect(undoButton()).toBeDisabled()
  })

  it('clears the redo stack when a new edit follows an undo', () => {
    renderResult()
    editSegment('第一句', 'A')
    fireEvent.click(undoButton())
    expect(redoButton()).not.toBeDisabled()

    editSegment('第二句', 'B')
    expect(redoButton()).toBeDisabled()
  })

  it('undoes and redoes via Ctrl+Z / Ctrl+Shift+Z', () => {
    renderResult()
    editSegment('第一句', '改过的第一句')

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(screen.getByText('第一句')).toBeDefined()

    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(screen.getByText('改过的第一句')).toBeDefined()
  })

  it('reports edited segments to the parent', () => {
    const onSegmentsChange = renderResult()
    editSegment('第一句', '改过的第一句')

    expect(onSegmentsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'seg-0', text: '改过的第一句', edited: true }),
      ])
    )
  })
})

describe('LyricsResult playback highlight', () => {
  it('highlights the row whose time range contains the playback position', () => {
    const { container } = render(
      <LyricsResult
        result={makeFixtureResult()}
        audioInfo={{
          filePath: '/tmp/test.wav',
          fileName: 'song.mp3',
          duration: 10,
          sampleRate: 16000,
          format: 'mp3',
          originalPath: '/tmp/test.mp3',
        }}
        onSegmentsChange={vi.fn()}
      />
    )
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { value: 7, writable: true })
    fireEvent.timeUpdate(audio)

    const activeRow = screen.getByText('第二句').closest('[draggable]')!
    const idleRow = screen.getByText('第一句').closest('[draggable]')!
    expect(activeRow.className).toContain('bg-blue-500/10')
    expect(idleRow.className).not.toContain('bg-blue-500/10')
  })
})

describe('LyricsResult reorder + undo', () => {
  function makeDataTransfer() {
    const store: Record<string, string> = {}
    return {
      effectAllowed: '',
      dropEffect: '',
      setData: (k: string, v: string) => { store[k] = v },
      getData: (k: string) => store[k] ?? '',
    }
  }

  function dragRow(fromText: string, toText: string) {
    const dataTransfer = makeDataTransfer()
    const from = screen.getByText(fromText).closest('[draggable]')!
    const to = screen.getByText(toText).closest('[draggable]')!
    fireEvent.dragStart(from, { dataTransfer })
    fireEvent.dragOver(to, { dataTransfer })
    fireEvent.drop(to, { dataTransfer })
  }

  it('restores the original order when a reorder is undone', () => {
    renderResult()
    dragRow('第一句', '第二句')

    let texts = screen.getAllByText(/^第[一二]句$/).map(el => el.textContent)
    expect(texts).toEqual(['第二句', '第一句'])

    fireEvent.click(undoButton())
    texts = screen.getAllByText(/^第[一二]句$/).map(el => el.textContent)
    expect(texts).toEqual(['第一句', '第二句'])
  })

  it('keeps segment identities intact when undoing past a reorder', () => {
    renderResult()
    // 编辑一次再排序：排序原地改 id 会污染编辑时的撤销快照
    editSegment('第一句', 'X')
    dragRow('X', '第二句')

    fireEvent.click(undoButton()) // 撤销排序
    fireEvent.click(undoButton()) // 撤销编辑，回到初始状态

    // 点「第二句」应该编辑的就是第二句，而不是被串到别的段落
    fireEvent.click(screen.getByText('第二句'))
    expect(screen.getByDisplayValue('第二句')).toBeDefined()
  })
})