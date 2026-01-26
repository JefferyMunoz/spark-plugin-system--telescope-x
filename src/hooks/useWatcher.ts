import { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

export type PetStatus = 'IDLE' | 'WORKING' | 'FINISHED';

export const useWatcher = () => {
  const [status, setStatus] = useState<PetStatus>('IDLE');

  useEffect(() => {
    const handleStatusChange = (_event: any, data: { status: PetStatus }) => {
      setStatus(data.status);
    };

    ipcRenderer.on('pet-status-change', handleStatusChange);
    return () => {
      ipcRenderer.removeListener('pet-status-change', handleStatusChange);
    };
  }, []);

  return status;
};
