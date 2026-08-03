import { mkdir, writeFile, readdir, stat, unlink, access, readFile } from 'fs/promises'
import { join } from 'path'
import { TranscriptionResult } from '../src/types'

// 保存一条历史记录（<dir>/<id>.json）。全部走异步 fs，不阻塞主进程。
// LRU 清理只在新增文件时执行——编辑写回是覆盖已有 id，跳过整个目录扫描；
// 排序用文件 mtime，不需要把每个 JSON 读出来解析 createdAt。
export async function saveHistoryEntry(
  historyDir: string,
  result: TranscriptionResult,
  maxEntries: number,
): Promise<void> {
  await mkdir(historyDir, { recursive: true })

  const historyFile = join(historyDir, `${result.id}.json`)
  const isNew = await access(historyFile).then(() => false, () => true)

  await writeFile(historyFile, JSON.stringify(result, null, 2), 'utf-8')
  if (!isNew) return

  const names = (await readdir(historyDir)).filter(f => f.endsWith('.json'))
  if (names.length <= maxEntries) return

  const withTimes = await Promise.all(
    names.map(async name => {
      const path = join(historyDir, name)
      try {
        return { path, time: (await stat(path)).mtimeMs }
      } catch {
        return { path, time: 0 }
      }
    }),
  )
  const oldest = withTimes.sort((a, b) => a.time - b.time).slice(0, names.length - maxEntries)
  await Promise.all(oldest.map(entry => unlink(entry.path).catch(() => {})))
}

// 读取全部历史，按 createdAt 新→旧排序并截断。损坏的 JSON 跳过，不拖垮整个列表。
export async function loadHistoryEntries(
  historyDir: string,
  maxEntries: number,
): Promise<TranscriptionResult[]> {
  const names = await readdir(historyDir).catch(() => [] as string[])
  const entries = await Promise.all(
    names
      .filter(name => name.endsWith('.json'))
      .map(async name => {
        try {
          return JSON.parse(await readFile(join(historyDir, name), 'utf-8')) as TranscriptionResult
        } catch {
          return null
        }
      }),
  )
  return entries
    .filter((e): e is TranscriptionResult => e !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, maxEntries)
}

export async function deleteHistoryEntry(historyDir: string, id: string): Promise<void> {
  await unlink(join(historyDir, `${id}.json`)).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e
  })
}
