/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  electronAPI: {
    getAppVersion: () => Promise<string>;
    getBackendStatus: () => Promise<boolean>;
    openFileDialog: (options: any) => Promise<any>;
    saveFileDialog: (options: any) => Promise<any>;
  };
}
