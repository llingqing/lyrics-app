import { writeFileSync } from 'fs'
import { dialog, BrowserWindow } from 'electron'
import { LyricSegment } from '../src/types'
import { segmentsToLrc, segmentsToPlainText, segmentsToSrt } from '../src/utils/lrc'

function getExporter(format: 'txt' | 'lrc' | 'srt'): (segments: LyricSegment[]) => string {
  switch (format) {
    case 'txt': return segmentsToPlainText
    case 'lrc': return segmentsToLrc
    case 'srt': return segmentsToSrt
  }
}

export function exportToFile(segments: LyricSegment[], filePath: string, format: 'txt' | 'lrc' | 'srt'): void {
  const exporter = getExporter(format)
  const content = exporter(segments)
  writeFileSync(filePath, content, 'utf-8')
}

export async function showExportDialog(
  win: BrowserWindow,
  format: 'txt' | 'lrc' | 'srt',
  content: string,
): Promise<string | null> {
  const filters: Record<string, Electron.FileFilter[]> = {
    txt: [{ name: '文本文件', extensions: ['txt'] }],
    lrc: [{ name: '歌词文件', extensions: ['lrc'] }],
    srt: [{ name: '字幕文件', extensions: ['srt'] }],
  }
  const labels: Record<string, string> = {
    txt: '纯文本',
    lrc: 'LRC 歌词',
    srt: 'SRT 字幕',
  }

  const result = await dialog.showSaveDialog(win, {
    title: `导出${labels[format]}`,
    defaultPath: `lyrics.${format}`,
    filters: filters[format],
  })

  if (result.canceled || !result.filePath) return null

  writeFileSync(result.filePath, content, 'utf-8')
  return result.filePath
}
