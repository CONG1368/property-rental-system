import { ref } from 'vue';

type EventCallback = (data: any) => void;

let ws: WebSocket | null = null;
const listeners = new Map<string, Set<EventCallback>>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const isConnected = ref(false);

function getWsUrl(): string {
  // 生产模式（Electron file:// 协议）下 hostname 为空，回退到 localhost
  const isProd = import.meta.env.PROD;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = isProd ? 'localhost' : window.location.hostname;
  const port = isProd ? '3001' : (import.meta.env.VITE_API_PORT || '3001');
  return `${protocol}//${host}:${port}/ws`;
}

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      isConnected.value = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    ws.onmessage = (event) => {
      try {
        const { event: eventName, data } = JSON.parse(event.data);
        const cbs = listeners.get(eventName);
        if (cbs) {
          cbs.forEach((cb) => cb(data));
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      isConnected.value = false;
      // 3 秒后自动重连
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch { /* connection failed, will retry */ }
}

export function useWebSocket() {
  function on(eventName: string, callback: EventCallback) {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName)!.add(callback);
    return () => {
      listeners.get(eventName)?.delete(callback);
    };
  }

  function off(eventName: string, callback: EventCallback) {
    listeners.get(eventName)?.delete(callback);
  }

  // 确保连接已建立
  connect();

  return { on, off, isConnected };
}
