import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

Menu.setApplicationMenu(null)

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    title: 'Clash Profile GUI',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1000,
    minWidth: 1000,
    height: 600,
    minHeight: 600,
    center: true,
    show: false, // 初始隐藏主窗口
    // titleBarStyle: 'hidden',
    // frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // win.webContents.openDevTools()

  win.webContents.on('did-finish-load', () => {
    win?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

ipcMain.on('load-profile', async event => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'YAML Files', extensions: ['yml', 'yaml'] }]
  })
  if (!canceled) {
    const content = fs.readFileSync(filePaths[0], 'utf-8')
    event.sender.send('profile-loaded', content)
  }
})

function padding(num: number) {
  if (num >= 0 && num <= 9) {
    return `0${num}`
  }
  return `${num}`
}

ipcMain.on('save-profile', async (event, yamlStr) => {
  const date = new Date()
  const filename = `profile-${padding(date.getMonth() + 1)}${padding(date.getDate())}${padding(date.getSeconds())}.yml`
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath('documents'), filename), // 设置默认文件名
    filters: [{ name: 'YAML Files', extensions: ['yml', 'yaml'] }]
  })
  if (!canceled) {
    fs.writeFileSync(filePath, '\ufeff' + yamlStr, 'utf8') // 添加 BOM 解决中文乱码
    event.sender.send('profile-saved', true)
  }
})
