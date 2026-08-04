import { useState } from 'react'
import { useModels } from '../hooks/useModels'
import { LOCAL_MODELS } from '../config/models'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

export default function ModelManager() {
  const { available, sizes, downloading, download, cancelDownload, deleteModel, error } = useModels()
  // 与历史面板一致的两步确认；移开鼠标复位
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const totalBytes = Object.values(sizes).reduce((sum, n) => sum + n, 0)

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm text-gray-400 font-medium">模型管理</h3>
        {totalBytes > 0 && (
          <span className="text-xs text-gray-600">已占用 {formatBytes(totalBytes)}</span>
        )}
      </div>
      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        {LOCAL_MODELS.map(m => {
          const isDownloaded = available[m.value]
          const dlPercent = downloading[m.value]
          const isDownloading = dlPercent !== undefined && dlPercent < 100

          return (
            <div
              key={m.value}
              className="relative rounded-lg border border-gray-700 p-3 text-center overflow-hidden"
              onMouseLeave={() => setConfirmingDelete(current => (current === m.value ? null : current))}
            >
              {isDownloading && (
                <div
                  className="absolute inset-0 bg-blue-500/10 transition-all duration-300"
                  style={{ width: `${dlPercent}%` }}
                />
              )}
              <div className="relative z-10">
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{m.size}</div>
                <div className="text-xs text-gray-600">{m.desc}</div>

                {isDownloaded ? (
                  <span className="inline-flex items-center gap-2 mt-2 text-xs">
                    <span className="text-green-400">✓ 已下载</span>
                    <button
                      aria-label="删除模型"
                      onClick={() => {
                        if (confirmingDelete === m.value) {
                          setConfirmingDelete(null)
                          deleteModel(m.value)
                        } else {
                          setConfirmingDelete(m.value)
                        }
                      }}
                      className={
                        confirmingDelete === m.value
                          ? 'text-red-400 transition-colors'
                          : 'text-gray-600 hover:text-red-400 transition-colors'
                      }
                    >
                      {confirmingDelete === m.value ? '确认删除' : '删除'}
                    </button>
                  </span>
                ) : isDownloading ? (
                  <span className="inline-flex items-center gap-2 mt-2 text-xs text-blue-400">
                    {dlPercent}%
                    <button
                      aria-label="取消下载"
                      onClick={() => cancelDownload(m.value)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => download(m.value)}
                    className="mt-2 text-xs py-1 px-2 rounded border border-gray-600 hover:border-blue-400 hover:text-blue-400 transition-colors"
                  >
                    下载
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
