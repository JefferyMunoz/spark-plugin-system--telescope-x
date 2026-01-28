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

  // 调用浏览器代理（用于考试答题）
  callAgentBrowser: (params) => {
    return ipcRenderer.invoke('msg-trigger-async', { type: 'callAgentBrowser', data: params });
  },

  // 执行 agent-browser 命令（通用接口）
  agentBrowserCmd: async (params) => {
    try {
      const result = await ipcRenderer.invoke('msg-trigger-async', { type: 'agentBrowserCmd', data: params });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // 数据库操作 - 保存知识库
  dbPut: (params) => {
    return ipcRenderer.invoke('msg-trigger-async', { type: 'dbPut', data: params });
  },

  // 数据库操作 - 查询知识库
  dbGet: (params) => {
    return ipcRenderer.invoke('msg-trigger-async', { type: 'dbGet', data: params });
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
  },

  ping: () => {
    return ipcRenderer.invoke('msg-trigger-async', { type: 'ping' });
  },

  setExpendHeight: (height) => {
    return ipcRenderer.send('msg-trigger', { type: 'setExpendHeight', data: { height } });
  },

  installDependencies: (params) => {
    return ipcRenderer.invoke('msg-trigger-async', { type: 'installDependencies', data: params });
  },

  checkDependencies: () => {
    return ipcRenderer.invoke('msg-trigger-async', { type: 'checkDependencies' });
  },

  // CLI 执行接口 - 执行 shell 命令并实时返回输出
  executeCli: async (params) => {
    const { command, args = [], cwd, onOutput } = params;

    // 设置输出监听器
    let outputHandler = null;
    if (onOutput) {
      outputHandler = (_event, data) => {
        onOutput(data);
      };
      ipcRenderer.on('ts-cli-output', outputHandler);
    }

    try {
      const result = await ipcRenderer.invoke('ts-execute-cli', { command, args, cwd });
      return result;
    } catch (error) {
      return { success: false, ...error };
    } finally {
      // 清理监听器
      if (outputHandler) {
        ipcRenderer.removeListener('ts-cli-output', outputHandler);
      }
    }
  }
};

// 合并 API，不覆盖 spark-master 已有的方法
for (const key in pluginAPI) {
  if (!(key in window.spark)) {
    window.spark[key] = pluginAPI[key];
  }
}
