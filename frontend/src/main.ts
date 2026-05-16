import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import App from './App.vue';
import router from './router';
import './styles/global.scss';

// 桌面应用：每次启动都需要重新登录认证
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
localStorage.removeItem('userRole');
const APP_VERSION = '1.0.2';
localStorage.setItem('appVersion', APP_VERSION);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

// 全局错误处理 — 错误直接显示在页面上方便调试
if (import.meta.env.DEV) {
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue Error]', err, info);
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f56c6c;color:#fff;padding:12px 20px;z-index:99999;font-size:13px;white-space:pre-wrap;max-height:200px;overflow:auto;';
    el.textContent = '[Vue Error] ' + (err instanceof Error ? err.message : String(err)) + '\nInfo: ' + info;
    document.body.prepend(el);
  };
}

app.mount('#app');
