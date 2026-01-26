import { ipcRenderer } from 'electron';

const getAllPorts: () => {
  console.log('[DependencyManager] getAllPorts called');
  // 调用 spark-master 的 getAllPorts API 获取真实的端口数据
  return ipcRenderer.invoke('msg-trigger-async', { type: 'getAllPorts' });
};

export { getAllPorts };