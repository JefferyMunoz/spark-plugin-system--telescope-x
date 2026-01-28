const path = require('path');
const { ipcMain, Notification, exec } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');

module.exports = () => {
  let floatingWindow = null;
  let petWindow = null;
  let registeredShortcuts = [];
  let watcher = null;

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

        // Pet Window IPCs
        ipcMain.on('pet-ignore-mouse', (event, ignore) => {
          if (petWindow && !petWindow.isDestroyed()) {
            petWindow.setIgnoreMouseEvents(ignore, { forward: true });
          }
        });

        ipcMain.on('pet-close', () => {
          if (petWindow && !petWindow.isDestroyed()) {
            petWindow.destroy();
            petWindow = null;
          }
        });

        ipcMain.on('pet-update-paths', (event, paths) => {
          startWatcher(paths);
        });

        ipcMain.on('pet-show', () => {
          createPetWindow();
        });

        ipcMain.on('pet-move-relative', (event, { dx, dy }) => {
          if (petWindow && !petWindow.isDestroyed()) {
            const pos = petWindow.getPosition();
            petWindow.setPosition(Math.round(pos[0] + dx), Math.round(pos[1] + dy));
          }
        });

        // CLI执行接口 - 用于执行 shell 命令并实时返回输出
        ipcMain.handle('ts-execute-cli', async (event, { command, args = [], cwd }) => {
          return new Promise((resolve, reject) => {
            const outputs = [];
            const errors = [];

            try {
              // 深度寻址：优先尝试从插件自身的模块树中解析 CLI 路径
              let cliBinPath = '';
              try {
                // 1. 尝试直接解析
                const pkgPath = require.resolve('@srd/spark-exam-cli/package.json');
                cliBinPath = path.join(path.dirname(pkgPath), 'bin/cli.js');
              } catch (e) {
                // 2. 兜底解析：基于文件系统寻找
                const possiblePaths = [
                  path.resolve(__dirname, './node_modules/@srd/spark-exam-cli/bin/cli.js'),
                  path.resolve(__dirname, '../node_modules/@srd/spark-exam-cli/bin/cli.js'),
                  path.resolve(process.cwd(), './node_modules/@srd/spark-exam-cli/bin/cli.js')
                ];
                for (const p of possiblePaths) {
                  if (fs.existsSync(p)) {
                    cliBinPath = p;
                    break;
                  }
                }
              }

              let finalCommand = command;
              if (command.includes('spark-exam') && cliBinPath) {
                // 强制重定向到绝对路径，并包裹双引号处理空格
                finalCommand = `node "${cliBinPath}"`;
                console.log(`[Telescope-X] Redirecting to: ${finalCommand}`);
              }

              const proc = spawn(finalCommand, args, {
                cwd: __dirname, // 强制在插件目录执行
                env: { ...process.env, NODE_NO_WARNINGS: '1' },
                shell: true
              });

              // 实时转发 stdout
              proc.stdout.on('data', (data) => {
                const text = data.toString();
                outputs.push(text);
                // 实时发送到渲染进程
                if (event.sender && !event.sender.isDestroyed()) {
                  event.sender.send('ts-cli-output', { type: 'stdout', data: text });
                }
              });

              // 实时转发 stderr
              proc.stderr.on('data', (data) => {
                const text = data.toString();
                errors.push(text);
                if (event.sender && !event.sender.isDestroyed()) {
                  event.sender.send('ts-cli-output', { type: 'stderr', data: text });
                }
              });

              proc.on('close', (code) => {
                const result = {
                  success: code === 0,
                  exitCode: code,
                  stdout: outputs.join(''),
                  stderr: errors.join('')
                };
                if (code === 0) {
                  resolve(result);
                } else {
                  reject(result);
                }
              });

              proc.on('error', (err) => {
                const errorResult = {
                  success: false,
                  exitCode: -1,
                  error: err.message,
                  stdout: outputs.join(''),
                  stderr: errors.join('')
                };
                reject(errorResult);
              });
            } catch (err) {
              reject({
                success: false,
                exitCode: -1,
                error: err.message
              });
            }
          });
        });
      }

      const createPetWindow = () => {
        if (petWindow && !petWindow.isDestroyed()) return;

        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const [w, h] = [200, 200];

        petWindow = new BrowserWindow({
          width: w,
          height: h,
          x: width - w - 20,
          y: height - h - 20,
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          resizable: false,
          skipTaskbar: true,
          hasShadow: false,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: false
          }
        });

        const petPath = path.join(__dirname, 'pet.html');
        petWindow.loadURL(`file://${petPath}`);

        // Default ignore mouse events for transparency
        petWindow.setIgnoreMouseEvents(true, { forward: true });

        petWindow.on('closed', () => {
          petWindow = null;
        });

        console.log('PetWindow created successfully');
      };

      const startWatcher = (paths) => {
        if (watcher) {
          watcher.close();
        }

        console.log('Starting pet watcher for paths:', paths);

        paths.forEach(p => {
          try {
            const resolvedPath = p.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
            if (!fs.existsSync(resolvedPath)) {
              console.log(`Watcher: Path does not exist: ${resolvedPath}`);
              return;
            }

            fs.watch(resolvedPath, (eventType, filename) => {
              console.log(`File changed: ${resolvedPath}`);
              if (petWindow && !petWindow.isDestroyed()) {
                petWindow.webContents.send('pet-status-change', { status: 'WORKING', path: resolvedPath });

                // Reset to IDLE after some time (simulating work finish if no further changes)
                // In a real scenario, we might want to watch the content or wait for a specific pattern
                setTimeout(() => {
                  if (petWindow && !petWindow.isDestroyed()) {
                    petWindow.webContents.send('pet-status-change', { status: 'IDLE' });
                  }
                }, 3000);
              }
            });
          } catch (e) {
            console.error(`Failed to watch path: ${p}`, e);
          }
        });
      };

      // Initial Pet Window creation
      createPetWindow();

      // Default watch paths
      const defaultPaths = [
        path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'sessions.jsonl')
      ];
      startWatcher(defaultPaths);

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
