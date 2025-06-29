import { Menu, app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
Menu.setApplicationMenu(null);
let win;
function createWindow() {
  win = new BrowserWindow({
    title: "Clash Profile GUI",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    width: 1e3,
    minWidth: 1e3,
    height: 600,
    minHeight: 600,
    center: true,
    show: false,
    // 初始隐藏主窗口
    // titleBarStyle: 'hidden',
    // frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.openDevTools();
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.show();
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.on("load-profile", async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "YAML Files", extensions: ["yml", "yaml"] }]
  });
  if (!canceled) {
    const content = fs.readFileSync(filePaths[0], "utf-8");
    event.sender.send("profile-loaded", content);
  }
});
function padding(num) {
  if (num >= 0 && num <= 9) {
    return `0${num}`;
  }
  return `${num}`;
}
ipcMain.on("save-profile", async (event, yamlStr) => {
  const date = /* @__PURE__ */ new Date();
  const filename = `profile-${padding(date.getMonth() + 1)}${padding(date.getDate())}${padding(date.getSeconds())}.yml`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath("documents"), filename),
    // 设置默认文件名
    filters: [{ name: "YAML Files", extensions: ["yml", "yaml"] }]
  });
  if (!canceled) {
    fs.writeFileSync(filePath, "\uFEFF" + yamlStr, "utf8");
    event.sender.send("profile-saved", true);
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
