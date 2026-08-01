import { useState, useCallback } from 'react'
import { LyricSegment } from '../../types'
import { segmentsToLrc, segmentsToPlainText, segmentsToSrt } from '../../utils/lrc'

interface Props {
  segments: LyricSegment[]
}

const FORMATS = [
  { key: 'lrc' as const, label: 'LRC 歌词' },
  { key: 'srt' as const, label: 'SRT' },
  { key: 'txt' as const, label: '纯文本' },
]

export default function ExportPanel({ segments }: Props) {
  const [previewFormat, setPreviewFormat] = useState<'lrc' | 'srt' | 'txt'>('lrc')
  const [copied, setCopied] = useState(false)

  const content = previewFormat === 'lrc' ? segmentsToLrc(segments)
    : previewFormat === 'srt' ? segmentsToSrt(segments)
    : segmentsToPlainText(segments)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  const handleExport = useCallback(() => {
    window.electronAPI.exportFile(previewFormat, content)
  }, [previewFormat, content])

  return (
    <div className="flex flex-col gap-4">
      {/* 预览格式切换 */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">预览格式:</span>
        <div className="flex gap-1">
          {FORMATS.map(f => (
            <button
              key={f.key}
              className={`py-1 px-3 rounded text-sm transition-colors ${
                previewFormat === f.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => setPreviewFormat(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 预览区域 */}
      <pre className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-gray-300 max-h-60 overflow-y-auto font-mono whitespace-pre-wrap">
        {content}
      </pre>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          className="py-2 px-4 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors text-sm"
        >
          {copied ? '✓ 已复制' : '复制内容'}
        </button>
        <button
          onClick={handleExport}
          className="py-2 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors text-sm"
        >
          导出文件...
        </button>
      </div>
    </div>
  )
}
