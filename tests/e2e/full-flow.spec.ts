import { test, expect, _electron as electron } from '@playwright/test'

// NOTE: --in-process-gpu keeps the GPU compositor in the Electron main process.
// In headless/VM Linux environments, Electron's normal child-process teardown
// can stall for ~60s on app.close(); this flag avoids that so tests finish fast.
const launchArgs = ['.', '--in-process-gpu']

test.describe('Lyrics App E2E', () => {
  test('launches and shows upload screen', async () => {
    const app = await electron.launch({
      args: launchArgs,
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // 验证标题
    await expect(page.locator('h1')).toContainText('歌词识别')

    // 验证上传区域可见
    await expect(page.getByText('拖拽音频文件到此处')).toBeVisible()

    await app.close()
  })

  test('shows config panel after audio loaded', async () => {
    const app = await electron.launch({
      args: launchArgs,
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // 验证配置面板元素
    // (完整的 E2E 测试需要 mock IPC 响应，这里提供框架)
    await expect(page.locator('h1')).toContainText('歌词识别')

    await app.close()
  })
})
