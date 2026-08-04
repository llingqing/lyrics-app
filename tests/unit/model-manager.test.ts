// @vitest-environment node
// 主进程模块：在 node 环境测（undici 的 FormData/Blob/File 行为与 Electron 主进程一致）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir: string

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
    isPackaged: false,
    getAppPath: () => userDataDir,
  },
}))

import { runCloudInference, downloadModel, cancelInference, parseWhisperJson, buildWhisperArgs } from '../../electron/model-manager'
import { InferenceConfig } from '../../src/types'

const fetchMock = vi.fn()

beforeEach(async () => {
  userDataDir = await mkdtemp(join(tmpdir(), 'model-manager-'))
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await rm(userDataDir, { recursive: true, force: true })
})

function apiResponse() {
  return {
    ok: true,
    json: async () => ({
      language: 'zh',
      segments: [{ start: 0, end: 3, text: '你好', avg_logprob: -0.2 }],
    }),
  }
}

async function makeAudioFile(): Promise<string> {
  const path = join(userDataDir, 'audio.wav')
  await writeFile(path, 'fake-wav')
  return path
}

function cloudConfig(overrides: Partial<InferenceConfig> = {}): InferenceConfig {
  return {
    filePath: '',
    modelName: 'base',
    engine: 'cloud',
    language: 'auto',
    cloudApiKey: 'sk-test',
    ...overrides,
  }
}

describe('runCloudInference', () => {
  it('defaults to the OpenAI endpoint and whisper-1 model', async () => {
    fetchMock.mockResolvedValue(apiResponse())
    const filePath = await makeAudioFile()

    await runCloudInference(cloudConfig({ filePath }), vi.fn())

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect((options.body as FormData).get('model')).toBe('whisper-1')
  })

  it('uses the configured third-party base URL and model', async () => {
    fetchMock.mockResolvedValue(apiResponse())
    const filePath = await makeAudioFile()

    await runCloudInference(
      cloudConfig({
        filePath,
        cloudBaseUrl: 'https://api.groq.com/openai/v1/', // 末尾斜杠应被规范化
        cloudModel: 'whisper-large-v3-turbo',
      }),
      vi.fn(),
    )

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions')
    expect((options.body as FormData).get('model')).toBe('whisper-large-v3-turbo')
  })

  it('emits only a completion progress event (the renderer owns the waiting animation)', async () => {
    fetchMock.mockResolvedValue(apiResponse())
    const filePath = await makeAudioFile()
    const onProgress = vi.fn()

    await runCloudInference(cloudConfig({ filePath }), onProgress)

    expect(onProgress.mock.calls.map(([p]) => p.percent)).toEqual([100])
  })

  it('uploads the original compressed file with its real filename', async () => {
    fetchMock.mockResolvedValue(apiResponse())
    const filePath = await makeAudioFile()
    const originalPath = join(userDataDir, 'song.mp3')
    await writeFile(originalPath, 'mp3-bytes')

    await runCloudInference(cloudConfig({ filePath, originalPath }), vi.fn())

    const file = (fetchMock.mock.calls[0][1].body as FormData).get('file') as File
    expect(file.name).toBe('song.mp3')
    expect(await file.text()).toBe('mp3-bytes')
  })

  it('falls back to the converted wav when the original is missing', async () => {
    fetchMock.mockResolvedValue(apiResponse())
    const filePath = await makeAudioFile()

    await runCloudInference(
      cloudConfig({ filePath, originalPath: join(userDataDir, 'gone.mp3') }),
      vi.fn(),
    )

    const file = (fetchMock.mock.calls[0][1].body as FormData).get('file') as File
    expect(await file.text()).toBe('fake-wav')
  })

  it('rejects uploads over 25MB with a clear error before calling the API', async () => {
    const filePath = await makeAudioFile()
    const originalPath = join(userDataDir, 'big.mp3')
    await writeFile(originalPath, Buffer.alloc(25 * 1024 * 1024 + 1))

    await expect(
      runCloudInference(cloudConfig({ filePath, originalPath }), vi.fn()),
    ).rejects.toThrow('25MB')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('cancelInference (cloud)', () => {
  it('aborts the in-flight request and rejects with a cancel error, without retrying', async () => {
    const filePath = await makeAudioFile()

    let fetchStarted!: () => void
    const fetchStartedPromise = new Promise<void>(resolve => { fetchStarted = resolve })

    fetchMock.mockImplementation((_url: string, options: { signal?: AbortSignal }) => {
      fetchStarted()
      return new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException('The operation was aborted', 'AbortError'))
        if (options.signal?.aborted) return abort()
        options.signal?.addEventListener('abort', abort)
      })
    })

    const promise = runCloudInference(cloudConfig({ filePath }), vi.fn())
    await fetchStartedPromise
    cancelInference()

    await expect(promise).rejects.toThrow('取消')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('parseWhisperJson', () => {
  function localConfig(overrides: Partial<InferenceConfig> = {}): InferenceConfig {
    return {
      filePath: '/tmp/a.wav',
      modelName: 'base',
      engine: 'local',
      language: 'auto',
      ...overrides,
    }
  }

  it('returns the detected language and token-probability confidence', () => {
    const json = JSON.stringify({
      result: { language: 'en' },
      transcription: [
        {
          offsets: { from: 1000, to: 3500 },
          text: ' Hello world',
          tokens: [
            { text: '[_BEG_]', p: 0.99 }, // special token, excluded from confidence
            { text: ' Hello', p: 0.9 },
            { text: ' world', p: 0.6 },
          ],
        },
      ],
    })

    const { segments, language } = parseWhisperJson(json, localConfig())

    expect(language).toBe('en')
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ start: 1, end: 3.5, text: 'Hello world' })
    expect(segments[0].confidence).toBeCloseTo(0.75)
  })

  it('skips blank segments and falls back to default confidence without tokens', () => {
    const json = JSON.stringify({
      result: { language: 'zh' },
      transcription: [
        { offsets: { from: 0, to: 2000 }, text: ' 你好' },
        { offsets: { from: 2000, to: 4000 }, text: '   ' },
      ],
    })

    const { segments } = parseWhisperJson(json, localConfig())

    expect(segments).toHaveLength(1)
    expect(segments[0].confidence).toBeCloseTo(0.85)
  })

  it('falls back to the configured language when detection is missing', () => {
    const json = JSON.stringify({
      transcription: [{ offsets: { from: 0, to: 1000 }, text: ' hi' }],
    })

    expect(parseWhisperJson(json, localConfig({ language: 'ja' })).language).toBe('ja')
    expect(parseWhisperJson(json, localConfig({ language: 'auto' })).language).toBe('auto')
  })
})

describe('buildWhisperArgs', () => {
  it('requests full JSON output so language and token probabilities are real', () => {
    const args = buildWhisperArgs(
      { filePath: '/tmp/a.wav', modelName: 'base', engine: 'local', language: 'auto' },
      '/models/ggml-base.bin',
      '/tmp/out',
    )

    expect(args).toContain('-ojf')
    expect(args).not.toContain('-osrt')
    expect(args).toContain('/models/ggml-base.bin')
    expect(args).toContain('/tmp/a.wav')
  })
})

describe('downloadModel', () => {
  it('knows the download URLs for the large models', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 })

    await expect(downloadModel('large-v3-turbo')).rejects.toThrow('HTTP 404')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    )

    await expect(downloadModel('large-v3')).rejects.toThrow('HTTP 404')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    )
  })
})
