import { writeFileSync, existsSync } from 'fs'
import { dialog, BrowserWindow } from 'electron'
import { LyricSegment } from '../src/types'
import { segmentsToLrc, segmentsToPlainText } from '../src/utils/lrc'

export function exportTxt(segments: LyricSegment[], filePath: string): void {
  const content = segmentsToPlainText(segments)
  writeFileSync(filePath, content, 'utf-8')
}

export function exportLrc(segments: LyricSegment[], filePath: string): void {
  const content = segmentsToLrc(segments)
  writeFileSync(filePath, content, 'utf-8')
}

export async function showExportDialog(
  win: BrowserWindow,
  format: 'txt' | 'lrc',
  content: string,
): Promise<string | null> {
  const ext = format === 'txt' ? 'txt' : 'lrc'
  const filters = format === 'txt'
    ? [{ name: '文本文件', extensions: ['txt'] }]
    : [{ name: '歌词文件', extensions: ['lrc'] }]

  const result = await dialog.showSaveDialog(win, {
    title: `导出${format === 'txt' ? '纯文本' : 'LRC 歌词'}`,
    defaultPath: `lyrics.${ext}`,
    filters,
  })

  if (result.canceled || !result.filePath) return null

  writeFileSync(result.filePath, content, 'utf-8')
  return result.filePath
}
