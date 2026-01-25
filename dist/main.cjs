const path = require('path');
const { ipcMain, Notification, exec } = require('electron');

module.exports = () => {
  let floatingWindow = null;
  let registeredShortcuts = [];

  return {
    onReady(ctx) {
      const { globalShortcut, clipboard, BrowserWindow, screen } = ctx.electron;

      if (!ipcMain.listenerCount('ts-copy')) {
        ipcMain.on('ts-copy', (event, text) => clipboard.writeText(text));
        ipcMain.on('ts-notify', (event, { title, body }) => new Notification({ title, body, silent: true }).show());
        ipcMain.on('ts-close', () => {
          if (floatingWindow && !floatingWindow.isDestroyed()) {
            floatingWindow.destroy();
            floatingWindow = null;
          }
        });
      }

      const createFloatingWindow = (text) => {
        if (floatingWindow && !floatingWindow.isDestroyed()) floatingWindow.destroy();

        const p = screen.getCursorScreenPoint();
        const d = screen.getDisplayNearestPoint(p);
        const [w, h] = [420, 560]; // 略微增大容器，让分层阴影完全展开
        let [x, y] = [p.x - w / 2, p.y + 15];
        if (x + w > d.bounds.x + d.bounds.width) x = d.bounds.x + d.bounds.width - w - 10;
        if (x < d.bounds.x) x = d.bounds.x + 10;
        if (y + h > d.bounds.y + d.bounds.height) y = p.y - h - 15;

        floatingWindow = new BrowserWindow({
          width: w, height: h, x, y,
          frame: false, transparent: true, alwaysOnTop: true,
          resizable: false, skipTaskbar: true,
          backgroundColor: '#00000000',
          hasShadow: false, // 彻底关闭原生阴影以消除黑边线条
          webPreferences: { nodeIntegration: true, contextIsolation: false, devTools: false }
        });

        const matrixPath = path.join(__dirname, 'matrix.html');
        floatingWindow.loadURL(`file://${matrixPath}?text=${encodeURIComponent(text || '')}`);
        floatingWindow.once('ready-to-show', () => {
          floatingWindow.show();
          floatingWindow.focus();
        });
        floatingWindow.on('blur', () => {
          if (floatingWindow && !floatingWindow.isDestroyed()) {
            floatingWindow.destroy();
            floatingWindow = null;
          }
        });
      };

      const trigger = () => {
        if (process.platform === 'darwin') {
          // 极致性能：直接执行并立刻回调，不再使用 Promise 延迟
          const { exec: cpExec } = require('child_process');
          cpExec(`osascript -e 'tell application "System Events" to keystroke "c" using {command down}'`, () => {
             // 极短延时 50ms 仅供剪贴板同步
             setTimeout(() => createFloatingWindow(clipboard.readText()), 50);
          });
        } else {
          createFloatingWindow(clipboard.readText());
        }
      };

      const register = () => {
        const keys = ['CommandOrControl+Shift+X', 'Alt+X'];
        registeredShortcuts.forEach(k => globalShortcut.unregister(k));
        registeredShortcuts = [];
        keys.forEach(k => { if (globalShortcut.register(k, trigger)) registeredShortcuts.push(k); });
      };

      setTimeout(register, 1000);
    }
  };
};
