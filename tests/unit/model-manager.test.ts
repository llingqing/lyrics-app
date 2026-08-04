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

import { runCloudInference, downloadModel, cancelInference } from '../../electron/model-manager'
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
