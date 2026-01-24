const { exec, execSync } = require('child_process');
const { clipboard } = require('electron');

window.spark = {
  // 基础能力
  copyText: (text) => clipboard.writeText(text),
  readText: () => clipboard.readText(),

  // 端口控制
  getProcessByPort: (port) => {
    return new Promise((resolve) => {
      const cmd = process.platform === 'win32'
        ? `netstat -ano | findstr :${port}`
        : `lsof -i :${port} -t`;

      exec(cmd, (err, stdout) => {
        if (err || !stdout) return resolve(null);
        resolve(stdout.trim().split('\n'));
      });
    });
  },

  killProcess: (pid) => {
    return new Promise((resolve) => {
      const cmd = process.platform === 'win32'
        ? `taskkill /F /PID ${pid}`
        : `kill -9 ${pid}`;

      exec(cmd, (err) => {
        resolve(!err);
      });
    });
  },

  // 快捷钩子
  onPluginEnter: (callback) => {
    window.onPluginEnter = callback;
  }
};
