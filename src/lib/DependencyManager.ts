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

  static async installAgent(onProgress: (data: ProgressData) => void): Promise<{ success: boolean, error?: string }> {
    try {
      const cleanup = getSpark().onEvent?.('dependency-progress', (data: ProgressData) => {
        onProgress(data);
      });

      const res = await getSpark().installDependencies?.({ name: 'browser-agent' });
      
      if (cleanup) cleanup();
      return {
        success: res?.success || false,
        error: res?.error
      };
    } catch (e: any) {
      console.error('Installation failed', e);
      return { success: false, error: e.message };
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
