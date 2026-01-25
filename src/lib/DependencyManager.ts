const getSpark = () => {
  return (window as any).spark || {};
};

export interface ProgressData {
  step: string;
  progress: number;
  log: string;
}

export class DependencyManager {
  static async checkAgent(): Promise<boolean> {
    try {
      const res = await getSpark().checkDependencies?.();
      return res?.installed || false;
    } catch (e) {
      return false;
    }
  }

  static async installAgent(onProgress: (data: ProgressData) => void): Promise<boolean> {
    try {
      const cleanup = getSpark().onEvent?.('dependency-progress', (data: ProgressData) => {
        onProgress(data);
      });

      const res = await getSpark().installDependencies?.();
      
      if (cleanup) cleanup();
      return res?.success || false;
    } catch (e) {
      console.error('Installation failed', e);
      return false;
    }
  }

  static async restartSpark() {
    try {
      await getSpark().restartApp?.();
    } catch (e) {
      console.error('Restart failed', e);
    }
  }
}
