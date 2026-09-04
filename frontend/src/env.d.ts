/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'element-plus/dist/locale/zh-cn.mjs';

/** 构建时注入：根 package.json 的 version */
declare const __APP_VERSION__: string;

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
    openPlatformLogin?: () => Promise<{ status: string }>;
    getMeterTokenStatus?: () => Promise<{ captured: boolean; tokenExpSec: number; expired: boolean }>;
    stopMeterSync?: () => Promise<{ status: string }>;
    onSmartMeterEvent?: (callback: (payload: any) => void) => void;
  };
}
