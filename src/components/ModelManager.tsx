import { useModels } from '../hooks/useModels'

const MODELS = [
  { value: 'tiny' as const, label: 'Tiny', size: '150MB', desc: '最快' },
  { value: 'base' as const, label: 'Base', size: '290MB', desc: '推荐' },
  { value: 'small' as const, label: 'Small', size: '950MB', desc: '更准确' },
  { value: 'medium' as const, label: 'Medium', size: '1.5GB', desc: '最准确' },
]

export default function ModelManager() {
  const { available, downloading, download, error } = useModels()

  return (
    <div className="max-w-lg mx-auto mt-8">
      <h3 className="text-sm text-gray-400 mb-3 font-medium">模型管理</h3>
      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      <div className="grid grid-cols-4 gap-2">
        {MODELS.map(m => {
          const isDownloaded = available[m.value]
          const dlPercent = downloading[m.value]
          const isDownloading = dlPercent !== undefined && dlPercent < 100

          return (
            <div
              key={m.value}
              className="relative rounded-lg border border-gray-700 p-3 text-center overflow-hidden"
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
                  <span className="inline-block mt-2 text-xs text-green-400">✓ 已下载</span>
                ) : isDownloading ? (
                  <span className="inline-block mt-2 text-xs text-blue-400">{dlPercent}%</span>
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
