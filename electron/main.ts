import { app, BrowserWindow, protocol } from 'electron'
import path from 'path'
import { readFile, stat, open as fsOpen } from 'fs/promises'

// 注册自定义协议用于播放本地音频（renderer 沙箱不能直接访问 file://）
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } },
])

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: '歌词识别',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const { registerHandlers } = require('./ipc-handlers')
  registerHandlers(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // 处理 media:// 协议 → 映射到本地文件（支持 Range 请求用于 seek）
  protocol.handle('media', async (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname)
    try {
      const fileStat = await stat(filePath)
      const fileSize = fileStat.size
      const ext = filePath.split('.').pop()?.toLowerCase() || ''
      const mimeMap: Record<string, string> = {
        mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
        ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
        opus: 'audio/opus', wma: 'audio/x-ms-wma',
      }
      const mimeType = mimeMap[ext] || 'audio/mpeg'

      const rangeHeader = request.headers.get('Range')
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
          const length = end - start + 1

          const fd = await fsOpen(filePath, 'r')
          const buf = Buffer.alloc(length)
          await fd.read(buf, 0, length, start)
          await fd.close()

          return new Response(buf, {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': String(length),
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
            },
          })
        }
      }

      const data = await readFile(filePath)
      return new Response(data, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        },
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
