import { app as i, BrowserWindow as l, ipcMain as c, dialog as d } from "electron";
import { fileURLToPath as g } from "node:url";
import n from "node:path";
import p from "fs";
const f = n.dirname(g(import.meta.url));
process.env.APP_ROOT = n.join(f, "..");
const _ = process.env.VITE_DEV_SERVER_URL, I = n.join(process.env.APP_ROOT, "dist-electron"), m = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = _ ? n.join(process.env.APP_ROOT, "public") : m;
let e;
function h() {
  e = new l({
    title: "Clash Profile GUI",
    icon: n.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    width: 1e3,
    minWidth: 1e3,
    height: 600,
    minHeight: 600,
    center: !0,
    show: !1,
    // 初始隐藏主窗口
    webPreferences: {
      preload: n.join(f, "preload.mjs"),
      nodeIntegration: !0,
      contextIsolation: !1
    }
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString()), e == null || e.show();
  }), e.loadFile(n.join(m, "index.html"));
}
i.on("window-all-closed", () => {
  process.platform !== "darwin" && (i.quit(), e = null);
});
i.on("activate", () => {
  l.getAllWindows().length === 0 && h();
});
i.whenReady().then(h);
c.on("load-profile", async (o) => {
  const { canceled: s, filePaths: t } = await d.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "YAML Files", extensions: ["yml", "yaml"] }]
  });
  if (!s) {
    const a = p.readFileSync(t[0], "utf-8");
    o.sender.send("profile-loaded", a);
  }
});
function r(o) {
  return o >= 0 && o <= 9 ? `0${o}` : `${o}`;
}
c.on("save-profile", async (o, s) => {
  const t = /* @__PURE__ */ new Date(), a = `profile-${r(t.getMonth() + 1)}${r(t.getDate())}${r(t.getSeconds())}.yml`, { canceled: w, filePath: P } = await d.showSaveDialog({
    defaultPath: n.join(i.getPath("documents"), a),
    // 设置默认文件名
    filters: [{ name: "YAML Files", extensions: ["yml", "yaml"] }]
  });
  w || (p.writeFileSync(P, "\uFEFF" + s, "utf8"), o.sender.send("profile-saved", !0));
});
export {
  I as MAIN_DIST,
  m as RENDERER_DIST,
  _ as VITE_DEV_SERVER_URL
};
