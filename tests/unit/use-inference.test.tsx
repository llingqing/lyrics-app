import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInference } from '../../src/hooks/useInference'
import { getMockElectronAPI } from '../setup'
import { InferenceConfig } from '../../src/types'

let mockAPI: ReturnType<typeof getMockElectronAPI>

const cloudConfig: InferenceConfig = {
  filePath: '/tmp/a.wav',
  modelName: 'base',
  engine: 'cloud',
  language: 'auto',
  cloudApiKey: 'sk-test',
}

beforeEach(() => {
  vi.useFakeTimers()
  mockAPI = getMockElectronAPI()
  mockAPI.startInference.mockResolvedValue(undefined)
  vi.stubGlobal('electronAPI', mockAPI)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useInference cloud virtual progress', () => {
  it('advances virtual progress while waiting for the API', async () => {
    const { result } = renderHook(() => useInference(cloudConfig))

    await act(async () => {
      await result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(1600)
    })

    expect(result.current.progress?.percent).toBeGreaterThan(0)
  })

  it('stops the virtual progress when inference errors', async () => {
    const { result } = renderHook(() => useInference(cloudConfig))
    const errorListener = mockAPI.onInferenceError.mock.calls[0][0]

    await act(async () => {
      await result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    act(() => {
      errorListener({ message: 'API 错误', code: 'INFERENCE_FAILED' })
    })
    const percentAtError = result.current.progress?.percent

    act(() => {
      vi.advanceTimersByTime(3200)
    })

    expect(result.current.error).toBe('API 错误')
    expect(result.current.progress?.percent).toBe(percentAtError)
  })
})
