/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'element-plus/dist/locale/zh-cn.mjs';

interface Window {
  electronAPI: {
    getAppVersion: () => Promise<string>;
    getBackendStatus: () => Promise<boolean>;
    getBackendUrl: () => Promise<string>;
    openFileDialog: (options: any) => Promise<any>;
    saveFileDialog: (options: any) => Promise<any>;
    printHTML?: (html: string, title: string) => Promise<{ success: boolean; failureReason?: string }>;
    saveFile?: (options: any) => Promise<any>;
    onMenuNavigate: (callback: (path: string) => void) => void;
  };
}
