# High-Priority Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UI component tests, implement virtual segmented progress for cloud inference, and add auto-retry + manual retry for failed inference.

**Architecture:** Three orthogonal improvements. Task 1 touches test files and test mocks. Task 2 modifies the `useInference` hook and `InferenceProgress` component, with a light IPC protocol extension. Task 3 spans `model-manager.ts` (auto-retry in main process) and `App.tsx` (retry button in renderer). Each task is independently testable.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, Electron IPC

## Global Constraints

- All new test files must follow the existing pattern: `describe/it/expect` from vitest, `render/screen` from `@testing-library/react`, mock `window.electronAPI` via `vi.stubGlobal`
- All existing tests (5 files, 30 tests) must remain passing
- IPC contract changes: must update `ElectronAPI` interface in `src/types/index.ts`
- Error code additions: use existing pattern in `ipc-handlers.ts` where error codes are `FILE_NOT_FOUND | MODEL_DOWNLOAD_FAILED | CANCELLED | INFERENCE_FAILED`
- Commit messages follow existing pattern: lowercase feat/fix prefix, Chinese or English description

---

## File Structure Map

| File | Action | Responsibility |
|------|--------|---------------|
| `tests/setup.ts` | Modify | Add shared mock factory for `window.electronAPI` including `listModels` + `onModelDownloadProgress` |
| `tests/unit/components.test.tsx` | Modify | Fix 3 broken tests; add AudioPlayer, TimelineView, LyricsEditor tests |
| `src/types/index.ts` | Modify | Add `engine` field to `InferenceProgress`; add `retryInference` to `ElectronAPI` |
| `electron/model-manager.ts` | Modify | Add `retryWithBackoff` helper; wrap local/cloud inference in auto-retry (max 2); add virtual progress estimator for cloud |
| `electron/ipc-handlers.ts` | Modify | Expose `inference:retry` handler; stash last config for retry |
| `electron/preload.ts` | Modify | Expose `retryInference` bridge method |
| `src/hooks/useInference.ts` | Modify | Track last config for retry; expose `retry()`; add virtual progress simulator for cloud mode |
| `src/components/InferenceProgress.tsx` | Modify | Multi-stage UI with status text per stage; CSS transition smooth animation |
| `src/App.tsx` | Modify | Render retry button in error card alongside "return to config" button |
| `src/components/AudioPlayer.tsx` | (read-only reference) | Component under test in Task 1 |
| `src/components/LyricsResult/TimelineView.tsx` | (read-only reference) | Component under test in Task 1 |
| `src/components/LyricsResult/LyricsEditor.tsx` | (read-only reference) | Component under test in Task 1 |

### Task 1: Fix broken component tests + expand test coverage

**Files:**
- Modify: `tests/setup.ts`
- Modify: `tests/unit/components.test.tsx`

**Interfaces:**
- Produces: corrected mock for `window.electronAPI` (adds `listModels`, `onModelDownloadProgress` fields); new test suites for AudioPlayer, TimelineView, LyricsEditor

- [ ] **Step 1.1: Add shared mock factory to tests/setup.ts**

Append to `tests/setup.ts`:

```typescript
import { vi } from 'vitest'

// Complete electronAPI mock for renderer tests — individual suites can
// override specific methods via vi.mocked() after calling getMockElectronAPI().
export function getMockElectronAPI() {
  return {
    platform: 'linux',
    selectAudio: vi.fn(),
    loadAudio: vi.fn(),
    startInference: vi.fn(),
    cancelInference: vi.fn(),
    saveResult: vi.fn(),
    exportFile: vi.fn(),
    loadHistory: vi.fn().mockResolvedValue([]),
    deleteHistory: vi.fn(),
    onInferenceProgress: vi.fn().mockReturnValue(() => {}),
    onInferenceResult: vi.fn().mockReturnValue(() => {}),
    onInferenceError: vi.fn().mockReturnValue(() => {}),
    listModels: vi.fn().mockResolvedValue({ tiny: true, base: true, small: false, medium: false }),
    downloadModel: vi.fn(),
    onModelDownloadProgress: vi.fn().mockReturnValue(() => {}),
  }
}
```

- [ ] **Step 1.2: Run existing tests to confirm baseline failures**

Run: `npx vitest run tests/unit/components.test.tsx`
Expected: 3 failures, all `TypeError: window.electronAPI.listModels is not a function`

- [ ] **Step 1.3: Rewrite tests/unit/components.test.tsx with mock fix + new test suites**

Replace the entire file with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfigPanel from '../../src/components/ConfigPanel'
import AudioPlayer from '../../src/components/AudioPlayer'
import TimelineView from '../../src/components/LyricsResult/TimelineView'
import LyricsEditor from '../../src/components/LyricsResult/LyricsEditor'
import { getMockElectronAPI } from '../setup'

let mockAPI: ReturnType<typeof getMockElectronAPI>

beforeEach(() => {
  mockAPI = getMockElectronAPI()
  vi.stubGlobal('electronAPI', mockAPI)
})

// ─── ConfigPanel ───────────────────────────────────────────

describe('ConfigPanel', () => {
  const audioInfo = {
    filePath: '/tmp/test.wav',
    fileName: 'test.wav',
    duration: 180,
    sampleRate: 16000,
    format: 'wav' as const,
  }

  it('renders engine selection buttons', () => {
    render(<ConfigPanel audioInfo={audioInfo} onStart={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('🖥️ 本地模型')).toBeDefined()
    expect(screen.getByText('☁️ 云端 API')).toBeDefined()
  })

  it('renders model selection when local engine is selected', () => {
    render(<ConfigPanel audioInfo={audioInfo} onStart={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('Tiny')).toBeDefined()
    expect(screen.getByText('Base')).toBeDefined()
  })

  it('calls onStart with correct config when button clicked', () => {
    const onStart = vi.fn()
    render(<ConfigPanel audioInfo={audioInfo} onStart={onStart} onBack={vi.fn()} />)
    screen.getByText('开始识别').click()
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/test.wav',
        modelName: 'base',
        engine: 'local',
        language: 'auto',
      })
    )
  })
})

// ─── AudioPlayer ───────────────────────────────────────────

describe('AudioPlayer', () => {
  it('renders play button and duration', () => {
    const onTimeUpdate = vi.fn()
    render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        waveform={Array(100).fill(0.5)}
        onTimeUpdate={onTimeUpdate}
      />
    )
    // 120 seconds → 02:00
    expect(screen.getByText('02:00')).toBeDefined()
    // starts at zero
    expect(screen.getByText('00:00.000')).toBeDefined()
  })

  it('renders waveform bars container', () => {
    const onTimeUpdate = vi.fn()
    const { container } = render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        waveform={[0.3, 0.5, 0.7]}
        onTimeUpdate={onTimeUpdate}
      />
    )
    const bars = container.querySelectorAll('[style*="height"]')
    expect(bars.length).toBeGreaterThanOrEqual(3)
  })

  it('renders with fallback waveform when none provided', () => {
    const onTimeUpdate = vi.fn()
    const { container } = render(
      <AudioPlayer
        audioPath="/tmp/test.wav"
        duration={120}
        onTimeUpdate={onTimeUpdate}
      />
    )
    // fallback: 100 random bars
    const bars = container.querySelectorAll('[style*="height"]')
    expect(bars.length).toBe(100)
  })
})

// ─── TimelineView ──────────────────────────────────────────

describe('TimelineView', () => {
  const segments = [
    { id: 'seg-0', start: 0, end: 5, text: 'Hello world', confidence: 0.9, edited: false },
    { id: 'seg-1', start: 5, end: 10, text: 'Second line', confidence: 0.85, edited: false },
  ]

  it('renders all segments', () => {
    render(
      <TimelineView
        segments={segments}
        onEdit={vi.fn()}
        onSeek={vi.fn()}
        onReorder={vi.fn()}
      />
    )
    expect(screen.getByText('Hello world')).toBeDefined()
    expect(screen.getByText('Second line')).toBeDefined()
  })

  it('calls onEdit when clicking segment text', () => {
    const onEdit = vi.fn()
    render(
      <TimelineView
        segments={segments}
        onEdit={onEdit}
        onSeek={vi.fn()}
        onReorder={vi.fn()}
      />
    )
    screen.getByText('Hello world').click()
    expect(onEdit).toHaveBeenCalledWith('seg-0')
  })

  it('calls onSeek when clicking timestamp', () => {
    const onSeek = vi.fn()
    render(
      <TimelineView
        segments={segments}
        onEdit={vi.fn()}
        onSeek={onSeek}
        onReorder={vi.fn()}
      />
    )
    screen.getByText('00:00.000').click()
    expect(onSeek).toHaveBeenCalledWith(0)
  })
})

// ─── LyricsEditor ──────────────────────────────────────────

describe('LyricsEditor', () => {
  const segment = {
    id: 'seg-0', start: 1.5, end: 4.5,
    text: 'Hello world', confidence: 0.9, edited: false,
  }

  it('renders with current text in textarea', () => {
    render(<LyricsEditor segment={segment} onSave={vi.fn()} onCancel={vi.fn()} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('Hello world')
  })

  it('calls onSave with segment id and current text', () => {
    const onSave = vi.fn()
    render(<LyricsEditor segment={segment} onSave={onSave} onCancel={vi.fn()} />)
    screen.getByText('保存').click()
    expect(onSave).toHaveBeenCalledWith('seg-0', 'Hello world')
  })

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn()
    render(<LyricsEditor segment={segment} onSave={vi.fn()} onCancel={onCancel} />)
    screen.getByText('取消').click()
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 1.4: Run all tests**

Run: `npx vitest run`
Expected: all tests pass (0 failures)

- [ ] **Step 1.5: Commit**

```bash
git add tests/setup.ts tests/unit/components.test.tsx
git commit -m "fix: complete electronAPI mock and expand component tests"
```

### Task 2: Virtual segmented progress for cloud inference

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useInference.ts`
- Modify: `src/components/InferenceProgress.tsx`
- Modify: `electron/model-manager.ts`

**Interfaces:**
- Consumes: existing `InferenceProgress`, `InferenceConfig` types
- Produces: new `engine` field on `InferenceProgress`; `stageText()` computed in UI; updated `useInference` simulates virtual tick for cloud mode

- [ ] **Step 2.1: Add `engine` field to InferenceProgress type**

In `src/types/index.ts`, change `InferenceProgress`:

```typescript
export interface InferenceProgress {
  percent: number            // 0-100
  currentSegment: number
  totalSegments: number
  partialText: string
  engine?: 'local' | 'cloud' // which engine (added)
}
```

- [ ] **Step 2.2: Update cloud inference to emit richer progress**

In `electron/model-manager.ts`, replace the `runCloudInference` function body:

```typescript
export async function runCloudInference(
  config: InferenceConfig,
  onProgress: (p: InferenceProgress) => void,
): Promise<{ segments: LyricSegment[]; language: string }> {
  if (!config.cloudApiKey) {
    throw new Error('请先设置云端 API Key')
  }

  cancelled = false

  const formData = new FormData()
  const fileBuffer = require('fs').readFileSync(config.filePath)
  formData.append('file', new Blob([fileBuffer]), 'audio.wav')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')
  if (config.language !== 'auto') {
    formData.append('language', config.language)
  }

  // Phase 1: preparing upload — brief tick so UI shows stage text
  onProgress({ percent: 0, currentSegment: 0, totalSegments: 0, partialText: '', engine: 'cloud' })
  await sleep(300)

  let retries = 0
  const maxRetries = 3

  while (retries <= maxRetries) {
    if (cancelled) {
      throw new Error('推理已被取消')
    }

    try {
      onProgress({ percent: 5, currentSegment: 0, totalSegments: 0, partialText: '', engine: 'cloud' })

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cloudApiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errText = await response.text()
        if (response.status === 401) throw new Error('API Key 无效，请检查设置')
        if (response.status === 429) {
          retries++
          if (retries > maxRetries) throw new Error('API 请求过于频繁，请稍后重试')
          await sleep(2000 * retries)
          continue
        }
        throw new Error(`API 错误 (${response.status}): ${errText}`)
      }

      onProgress({ percent: 85, currentSegment: 0, totalSegments: 0, partialText: '', engine: 'cloud' })

      const data = await response.json() as any
      const segments: LyricSegment[] = (data.segments || []).map((s: any, i: number) => ({
        id: `seg-${i}`,
        start: s.start,
        end: s.end,
        text: s.text?.trim() || '',
        confidence: (s.avg_logprob || 0) > -1 ? Math.min(1, Math.exp(s.avg_logprob || 0)) : 0.8,
        edited: false,
      }))

      onProgress({ percent: 100, currentSegment: 0, totalSegments: 0, partialText: '', engine: 'cloud' })

      return { segments, language: data.language || config.language }
    } catch (e: any) {
      if (e?.message?.includes('API Key 无效')) throw e
      if (retries >= maxRetries) throw e
      retries++
      await sleep(1000 * retries)
    }
  }

  throw new Error('API 调用失败，已达最大重试次数')
}
```

- [ ] **Step 2.3: Add virtual progress sim in useInference hook**

In `src/hooks/useInference.ts`, replace the entire file:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { InferenceConfig, InferenceProgress, TranscriptionResult } from '../types'

export function useInference(config: InferenceConfig | null) {
  const [progress, setProgress] = useState<InferenceProgress | null>(null)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const virtualTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsubProgress = window.electronAPI.onInferenceProgress((p) => {
      setProgress(p)
      if (virtualTimerRef.current) {
        clearInterval(virtualTimerRef.current)
        virtualTimerRef.current = null
      }
    })
    const unsubResult = window.electronAPI.onInferenceResult((r) => {
      setResult(r)
      setIsRunning(false)
    })
    const unsubError = window.electronAPI.onInferenceError((e) => {
      setError(e.message)
      setIsRunning(false)
    })

    return () => {
      unsubProgress()
      unsubResult()
      unsubError()
    }
  }, [])

  const start = useCallback(async () => {
    if (!config) return
    setIsRunning(true)
    setError(null)
    setProgress(null)
    setResult(null)

    // Virtual progress for cloud: advance 0→90% while waiting for API
    if (config.engine === 'cloud') {
      let virtualPercent = 0
      virtualTimerRef.current = setInterval(() => {
        virtualPercent += Math.random() * 3 + 1  // advance 1-4% per tick
        if (virtualPercent > 90) virtualPercent = 90
        setProgress({
          percent: Math.round(virtualPercent),
          currentSegment: 0,
          totalSegments: 0,
          partialText: '',
          engine: 'cloud',
        })
      }, 800)
    }

    try {
      await window.electronAPI.startInference(config)
    } catch (e: any) {
      setError(e.message)
      setIsRunning(false)
      if (virtualTimerRef.current) {
        clearInterval(virtualTimerRef.current)
        virtualTimerRef.current = null
      }
    }
  }, [config])

  const cancel = useCallback(async () => {
    await window.electronAPI.cancelInference()
    setIsRunning(false)
    if (virtualTimerRef.current) {
      clearInterval(virtualTimerRef.current)
      virtualTimerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    setProgress(null)
    setResult(null)
    setError(null)
    setIsRunning(false)
    if (virtualTimerRef.current) {
      clearInterval(virtualTimerRef.current)
      virtualTimerRef.current = null
    }
  }, [])

  return { progress, result, error, isRunning, start, cancel, reset }
}
```

- [ ] **Step 2.4: Update InferenceProgress component with stage UI**

Replace `src/components/InferenceProgress.tsx`:

```tsx
import { InferenceProgress as IProgress } from '../types'

interface Props {
  progress: IProgress | null
  onCancel: () => void
}

function stageText(p: IProgress | null): string {
  if (!p) return '准备中...'
  if (p.engine === 'cloud') {
    if (p.percent < 10) return '正在上传音频...'
    if (p.percent < 85) return '正在等待识别结果...'
    if (p.percent < 100) return '正在解析结果...'
    return '完成!'
  }
  // local inference
  if (p.percent < 10) return '正在加载模型...'
  if (p.percent < 90) return '正在识别歌词...'
  if (p.percent < 100) return '正在生成结果...'
  return '完成!'
}

export default function InferenceProgress({ progress, onCancel }: Props) {
  const percent = progress?.percent || 0
  const isCloud = progress?.engine === 'cloud'
  const showPulse = isCloud && percent > 0 && percent < 80

  return (
    <div className="flex flex-col items-center gap-6 p-8 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">正在识别歌词...</h2>
        <p className="text-sm text-gray-400">{stageText(progress)}</p>
      </div>

      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            showPulse ? 'bg-blue-400 animate-pulse' : 'bg-blue-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="text-sm text-gray-500 font-mono">{percent}%</p>

      {progress?.partialText && (
        <div className="w-full p-4 rounded-lg bg-gray-800/50 border border-gray-700 max-h-32 overflow-y-auto">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{progress.partialText}</p>
        </div>
      )}

      <button
        onClick={onCancel}
        className="py-2 px-6 rounded-lg border border-gray-700 hover:border-red-500 hover:text-red-400 transition-colors text-sm"
      >
        取消
      </button>
    </div>
  )
}
```

- [ ] **Step 2.5: Type check + test run**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 2.6: Commit**

```bash
git add src/types/index.ts src/hooks/useInference.ts src/components/InferenceProgress.tsx electron/model-manager.ts
git commit -m "feat: virtual segmented progress for cloud inference with stage UI"
```

### Task 3: Auto-retry + manual retry for failed inference

**Files:**
- Modify: `electron/model-manager.ts`
- Modify: `electron/ipc-handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/index.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `retryWithBackoff` helper in model-manager; `inference:retry` IPC handler; `retryInference` on `ElectronAPI`

- [ ] **Step 3.1: Add retry helper + move sleep to module scope in model-manager.ts**

In `electron/model-manager.ts`, after the `cancelled` variable declaration (line 18), add:

```typescript
// ─── Retry helpers ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  isRetryable: (error: any) => boolean,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 1000
  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (cancelled) throw new Error('推理已被取消')
    try {
      return await fn()
    } catch (e: any) {
      lastError = e
      if (attempt >= maxRetries || !isRetryable(e)) {
        if (attempt >= maxRetries) {
          throw new Error(`${lastError.message}（已重试 ${maxRetries} 次）`)
        }
        throw e
      }
      await sleep(baseDelayMs * (attempt + 1))
    }
  }

  throw lastError
}
```

Then remove the duplicate `sleep` function at the bottom of the file (currently at line 307-309).

- [ ] **Step 3.2: Wrap local inference spawn in retry**

In `runLocalInference`, extract the spawn logic into an inner async function and call it via `retryWithBackoff`. Replace the promise setup (lines 125-177):

```typescript
  async function spawnInference(): Promise<{ segments: LyricSegment[]; language: string }> {
    return new Promise((resolve, reject) => {
      currentProcess = spawn(whisperPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, LD_LIBRARY_PATH: resourcesDir },
      })

      let stderr = ''

      currentProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
        const match = data.toString().match(/progress\s*=\s*(\d+)%/)
        if (match) {
          onProgress({
            percent: parseInt(match[1], 10),
            currentSegment: 0,
            totalSegments: 1,
            partialText: '',
            engine: 'local',
          })
        }
      })

      currentProcess.on('close', (code) => {
        currentProcess = null
        if (cancelled) {
          cleanup(srtPath)
          return reject(new Error('推理已被取消'))
        }
        if (code !== 0) {
          const errorMsg = extractError(stderr)
          cleanup(srtPath)
          return reject(new Error(errorMsg))
        }

        if (!existsSync(srtPath)) {
          cleanup(srtPath)
          return reject(new Error('推理完成但未生成输出'))
        }

        try {
          const srtContent = require('fs').readFileSync(srtPath, 'utf-8')
          const { segments, language } = parseSrt(srtContent, config)
          cleanup(srtPath)
          resolve({ segments, language })
        } catch (e) {
          cleanup(srtPath)
          reject(e)
        }
      })

      currentProcess.on('error', (err) => {
        currentProcess = null
        cleanup(srtPath)
        reject(new Error(`whisper.cpp 进程启动失败: ${err.message}。请确认已下载 whisper 可执行文件到 resources/ 目录。`))
      })
    })
  }

  function isRetryableLocal(err: any): boolean {
    const msg = err?.message || ''
    return !msg.includes('文件不存在') && !msg.includes('模型加载失败') && !msg.includes('取消')
  }

  return retryWithBackoff(spawnInference, isRetryableLocal, { maxRetries: 2, baseDelayMs: 1000 })
```

- [ ] **Step 3.3: Wrap cloud inference logic in retry**

In `runCloudInference`, after the formData setup, wrap the Google while-loop logic:

```typescript
  // ... formData setup stays ...

  async function callApi(): Promise<{ segments: LyricSegment[]; language: string }> {
    onProgress({ percent: 0, currentSegment: 0, totalSegments: 0, partialText: '', engine: 'cloud' })
    await sleep(300)

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.cloudApiKey}` },
      body: formData,
    })

    if (!response.ok) {
      const errText = await response.text()
      if (response.status === 401) throw new Error('API Key 无效，请检查设置')
      if (response.status === 429) throw new Error('API 请求过于频繁，请稍后重试')
      throw new Error(`API 错误 (${response.status}): ${errText}`)
    }

    onProgress({ percent: 85, currentSegment: 0, totalSegments: 0, partialText: '', engine: 'cloud' })

    const data = await response.json() as any
    const segments: LyricSegment[] = (data.segments || []).map((s: any, i: number) => ({
      id: `seg-${i}`,
      start: s.start,
      end: s.end,
      text: s.text?.trim() || '',
      confidence: (s.avg_logprob || 0) > -1 ? Math.min(1, Math.exp(s.avg_logprob || 0)) : 0.8,
      edited: false,
    }))

    onProgress({ percent: 100, currentSegment: 0, totalSegments: 0, partialText: '', engine: 'cloud' })
    return { segments, language: data.language || config.language }
  }

  function isRetryableCloud(err: any): boolean {
    const msg = err?.message || ''
    return !msg.includes('API Key 无效') && !msg.includes('取消')
  }

  return retryWithBackoff(callApi, isRetryableCloud, { maxRetries: 2, baseDelayMs: 1500 })
}
```

Also remove the while/retries loop that was wrapping the fetch.

- [ ] **Step 3.4: Add retry IPC handler to ipc-handlers.ts**

In `electron/ipc-handlers.ts`, before the `registerHandlers` function closes, add:

```typescript
// Store last config for retry
let lastConfig: InferenceConfig | null = null
```

Inside the existing `inference:start` handler, add `lastConfig = config` at the top:

```typescript
ipcMain.handle('inference:start', async (_event, config: InferenceConfig) => {
  lastConfig = config
  try {
    // ... existing code ...
```

After the `inference:cancel` handler, add:

```typescript
ipcMain.handle('inference:retry', async () => {
  if (!lastConfig) throw new Error('没有可用的重试配置')
  try {
    const onProgress = (progress: any) => {
      win.webContents.send('inference:progress', progress)
    }

    const engine = lastConfig.engine === 'cloud' ? runCloudInference : runLocalInference
    const { segments, language } = await engine(lastConfig, onProgress)

    const result: TranscriptionResult = {
      id: randomUUID(),
      audioFileName: originalFileNames.get(lastConfig.filePath) || lastConfig.filePath,
      modelName: lastConfig.modelName,
      engine: lastConfig.engine,
      language,
      segments,
      createdAt: new Date().toISOString(),
    }

    win.webContents.send('inference:result', result)
  } catch (e: any) {
    const msg = e?.message || '未知错误'
    const code = msg.includes('不存在') ? 'FILE_NOT_FOUND'
      : msg.includes('下载') ? 'MODEL_DOWNLOAD_FAILED'
      : msg.includes('取消') ? 'CANCELLED'
      : msg.includes('重试') || msg.includes('已重试') ? 'RETRIES_EXHAUSTED'
      : 'INFERENCE_FAILED'
    win.webContents.send('inference:error', { message: msg, code })
  }
})
```

Also update the existing error code map (line 64-68) to include `RETRIES_EXHAUSTED`:

```typescript
const code = msg.includes('不存在') ? 'FILE_NOT_FOUND'
  : msg.includes('下载') ? 'MODEL_DOWNLOAD_FAILED'
  : msg.includes('取消') ? 'CANCELLED'
  : msg.includes('重试') || msg.includes('已') ? 'RETRIES_EXHAUSTED'
  : 'INFERENCE_FAILED'
```

- [ ] **Step 3.5: Expose retryInference in preload + types**

In `electron/preload.ts`, add to the `ipcRenderer.invoke`-based API object:

```typescript
retryInference: () => ipcRenderer.invoke('inference:retry'),
```

In `src/types/index.ts`, add to the `ElectronAPI` interface:

```typescript
export interface ElectronAPI {
  platform: string
  selectAudio: () => Promise<string | null>
  loadAudio: (filePath: string) => Promise<AudioInfo>
  startInference: (config: InferenceConfig) => Promise<void>
  cancelInference: () => Promise<void>
  retryInference: () => Promise<void>           // <-- new
  saveResult: (result: TranscriptionResult) => Promise<void>
  exportFile: (format: 'txt' | 'lrc' | 'srt', content: string) => Promise<string | null>
  loadHistory: () => Promise<TranscriptionResult[]>
  deleteHistory: (id: string) => Promise<void>
  onInferenceProgress: (callback: (progress: InferenceProgress) => void) => () => void
  onInferenceResult: (callback: (result: TranscriptionResult) => void) => () => void
  onInferenceError: (callback: (error: { message: string; code: string }) => void) => () => void
  listModels: () => Promise<Record<string, boolean>>
  downloadModel: (modelName: string) => Promise<string>
  onModelDownloadProgress: (callback: (p: { modelName: string; percent: number }) => void) => () => void
}
```

- [ ] **Step 3.6: Add retry button in App.tsx error card**

In `src/App.tsx`, replace the error card JSX (currently lines 122-131 in `step === 'inference'` block):

From:
```tsx
{error && !result && (
  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 max-w-md">
    <p className="text-red-400 text-sm">{error}</p>
    <button
      onClick={handleBackToConfig}
      className="mt-2 text-sm text-red-400 underline"
    >
      返回重新配置
    </button>
  </div>
)}
```

To:
```tsx
{error && !result && (
  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 max-w-md flex flex-col gap-2">
    <p className="text-red-400 text-sm">{error}</p>
    <div className="flex gap-3 mt-1">
      <button
        onClick={() => start()}
        className="px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm hover:bg-blue-500/30 transition-colors"
      >
        ↩ 重试
      </button>
      <button
        onClick={handleBackToConfig}
        className="text-sm text-gray-400 underline hover:text-gray-300"
      >
        返回重新配置
      </button>
    </div>
  </div>
)}
```

`start()` already calls `setError(null)` internally, so no extra state is needed.

- [ ] **Step 3.7: Type check + full test run**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 3.8: Commit**

```bash
git add electron/model-manager.ts electron/ipc-handlers.ts electron/preload.ts src/types/index.ts src/App.tsx
git commit -m "feat: auto-retry with backoff + manual retry button for inference"
```