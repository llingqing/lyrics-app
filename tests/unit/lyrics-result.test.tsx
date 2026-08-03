import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LyricsResult from '../../src/components/LyricsResult'
import { getMockElectronAPI } from '../setup'
import { TranscriptionResult } from '../../src/types'

beforeEach(() => {
  vi.stubGlobal('electronAPI', getMockElectronAPI())
})

const result: TranscriptionResult = {
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

function renderResult(onSegmentsChange = vi.fn()) {
  render(
    <LyricsResult
      result={result}
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