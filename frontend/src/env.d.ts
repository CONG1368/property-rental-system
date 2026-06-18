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
    getBackendStatus: () => Promise<{ ok: boolean; seedReady: boolean }>;
    getBackendUrl: () => Promise<string>;
    openFileDialog: (options: any) => Promise<any>;
    saveFileDialog: (options: any) => Promise<any>;
    printHTML?: (html: string, title: string) => Promise<{ success: boolean; failureReason?: string }>;
    exportPDF?: (html: string, title: string) => Promise<{ success: boolean; filePath?: string | null; error?: string }>;
    saveFile?: (options: any) => Promise<any>;
    onMenuNavigate: (callback: (path: string) => void) => void;
  };
}
