import { existsSync, unlinkSync } from 'fs'

// 会话期间创建的临时文件（预转的 16kHz WAV 等）。
// 加载新音频时释放上一个，应用退出时统一清理，避免在 tmpdir 里越积越多。
const tracked = new Set<string>()

export function trackTempFile(path: string): void {
  tracked.add(path)
}

export function releaseTempFile(path: string): void {
  tracked.delete(path)
  try {
    if (existsSync(path)) unlinkSync(path)
  } catch {
    // 文件被占用（如 Windows 上仍在读取）时留给系统清理
  }
}

export function cleanupTempFiles(): void {
  for (const path of [...tracked]) {
    releaseTempFile(path)
  }
}
