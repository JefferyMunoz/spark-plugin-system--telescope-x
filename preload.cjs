const { exec, execSync } = require('child_process');
const { clipboard, ipcRenderer } = require('electron');

// 保留 spark-master 原有的 API，只补充缺失的方法
if (!window.spark) {
  window.spark = {};
}

// 保留原有的 API 属性
const existingKeys = Object.keys(window.spark);

// 合并插件特定的功能
const pluginAPI = {
  // 基础能力（如果 spark-master 没提供）
  copyText: (text) => clipboard.writeText(text),
  readText: () => clipboard.readText(),

  // 端口控制 - 获取所有端口（调用 spark-master API）
  getAllPorts: () => {
    return ipcRenderer.invoke('msg-trigger-async', { type: 'getAllPorts' });
  },

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

// 合并 API，不覆盖 spark-master 已有的方法
for (const key in pluginAPI) {
  if (!(key in window.spark)) {
    window.spark[key] = pluginAPI[key];
  }
}
