# Property Rental Comprehensive Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Electron desktop application for property rental management covering rent collection, financial reporting, and contract management.

**Architecture:** Electron main process manages MySQL portable + Redis + Express backend child process. Vue3 renderer communicates via REST API to localhost:3001. Sequelize ORM over MySQL 8.0 for persistent storage, Redis for caching/sessions/queues.

**Tech Stack:** Electron 28+ / Vue 3.4+ / Element Plus 2.5+ / TypeScript / Pinia / Node.js 20 LTS / Express 4.x / Sequelize 6.x / MySQL 8.0 / Redis 7.x / ECharts 5.x

---

## Phase 0: Project Scaffold & Foundation

### Task 0.1: Initialize project structure and root monorepo

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `electron-builder.yml`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "property-rental-system",
  "version": "1.0.0",
  "private": true,
  "description": "物业租赁综合管理系统",
  "main": "dist/electron/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend && npm run build:electron",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "build:electron": "tsc -p electron/tsconfig.json && electron-builder",
    "postinstall": "cd frontend && npm install && cd ../backend && npm install"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "electron": "^28.2.0",
    "electron-builder": "^24.9.1",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
runtime/
.env
*.log
frontend/dist/
backend/dist/
```

- [ ] **Step 3: Create electron-builder.yml**

```yaml
appId: com.property-rental.system
productName: 物业租赁综合管理系统
directories:
  output: release
files:
  - dist/**/*
  - runtime/**/*
  - frontend/dist/**/*
  - backend/dist/**/*
extraResources:
  - from: runtime/
    to: runtime/
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
win:
  target: nsis
  icon: frontend/public/icon.ico
```

- [ ] **Step 4: Run npm install**

```bash
cd "E:\物业租赁综合管理系统" && npm install
```

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore electron-builder.yml package-lock.json
git commit -m "chore: initialize project scaffold and root config"
```

---

### Task 0.2: Initialize Electron main process

**Files:**
- Create: `electron/tsconfig.json`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`

- [ ] **Step 1: Create electron/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "../dist/electron",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 2: Create electron/main.ts**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawnBackend } from './spawn-backend';
import { spawnMysql } from './spawn-mysql';
import { spawnRedis } from './spawn-redis';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: '物业租赁综合管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await spawnMysql();
    await spawnRedis();
    await spawnBackend();
  } catch (err) {
    console.error('Failed to start backend services:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  // Backend and services are terminated via child_process kill on app quit
});
```

- [ ] **Step 3: Create electron/preload.ts**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  openFileDialog: (options: any) => ipcRenderer.invoke('open-file-dialog', options),
  saveFileDialog: (options: any) => ipcRenderer.invoke('save-file-dialog', options),
});
```

- [ ] **Step 4: Commit**

```bash
git add electron/
git commit -m "feat: add Electron main process and preload script"
```

---

### Task 0.3: Create service spawners (MySQL, Redis, Backend)

**Files:**
- Create: `electron/spawn-mysql.ts`
- Create: `electron/spawn-redis.ts`
- Create: `electron/spawn-backend.ts`

- [ ] **Step 1: Create electron/spawn-mysql.ts**

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let mysqlProcess: ChildProcess | null = null;

export function spawnMysql(): Promise<void> {
  return new Promise((resolve, reject) => {
    const mysqlPath = path.join(
      process.resourcesPath || path.join(__dirname, '../../runtime'),
      'mysql/bin/mysqld.exe'
    );
    const dataDir = path.join(
      process.resourcesPath || path.join(__dirname, '../../runtime'),
      'mysql/data'
    );

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      // Initialize data directory for first run
      const initProcess = spawn(mysqlPath, [
        '--initialize-insecure',
        `--datadir=${dataDir}`,
      ]);
      initProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MySQL init failed with code ${code}`));
          return;
        }
        startMysqlService(mysqlPath, dataDir, resolve, reject);
      });
    } else {
      startMysqlService(mysqlPath, dataDir, resolve, reject);
    }
  });
}

function startMysqlService(
  mysqlPath: string,
  dataDir: string,
  resolve: () => void,
  reject: (err: Error) => void
) {
  mysqlProcess = spawn(mysqlPath, [
    '--datadir=' + dataDir,
    '--port=3306',
    '--bind-address=127.0.0.1',
    '--skip-grant-tables',
  ]);

  mysqlProcess.stderr?.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('ready for connections')) {
      resolve();
    }
  });

  // Timeout fallback
  setTimeout(resolve, 5000);

  mysqlProcess.on('error', reject);
}

export function stopMysql() {
  if (mysqlProcess) {
    mysqlProcess.kill('SIGTERM');
    mysqlProcess = null;
  }
}
```

- [ ] **Step 2: Create electron/spawn-redis.ts**

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

let redisProcess: ChildProcess | null = null;

export function spawnRedis(): Promise<void> {
  return new Promise((resolve, reject) => {
    const redisPath = path.join(
      process.resourcesPath || path.join(__dirname, '../../runtime'),
      'redis/redis-server.exe'
    );

    redisProcess = spawn(redisPath, ['--port', '6379', '--bind', '127.0.0.1']);

    redisProcess.stdout?.on('data', (data) => {
      if (data.toString().includes('Ready to accept connections')) {
        resolve();
      }
    });

    redisProcess.on('error', reject);
    setTimeout(resolve, 4000);
  });
}

export function stopRedis() {
  if (redisProcess) {
    redisProcess.kill('SIGTERM');
    redisProcess = null;
  }
}
```

- [ ] **Step 3: Create electron/spawn-backend.ts**

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

let backendProcess: ChildProcess | null = null;

export function spawnBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendPath = path.join(
      process.resourcesPath || path.join(__dirname, '../../backend'),
      'dist/index.js'
    );

    backendProcess = spawn('node', [backendPath], {
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: '3001',
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_NAME: 'property_rental',
        DB_USER: 'root',
        DB_PASSWORD: '',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: '6379',
      },
    });

    backendProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      console.log('[Backend]', msg);
      if (msg.includes('Server running')) {
        resolve();
      }
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error('[Backend Error]', data.toString());
    });

    backendProcess.on('error', reject);
    setTimeout(resolve, 5000);
  });
}

export function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/spawn-*.ts
git commit -m "feat: add service spawners for MySQL, Redis, and backend"
```

---

### Task 0.4: Initialize Vue3 frontend project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/env.d.ts`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "property-rental-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.21",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.7",
    "axios": "^1.6.7",
    "element-plus": "^2.5.6",
    "@element-plus/icons-vue": "^2.3.1",
    "echarts": "^5.5.0",
    "vue-echarts": "^6.6.9",
    "dayjs": "^1.11.10",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "typescript": "^5.3.3",
    "vite": "^5.1.4",
    "vue-tsc": "^2.0.6",
    "sass": "^1.71.1",
    "unplugin-auto-import": "^0.17.5",
    "unplugin-vue-components": "^0.26.0"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;`,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
```

- [ ] **Step 3: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>物业租赁综合管理系统</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Create frontend/src/main.ts**

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import App from './App.vue';
import router from './router';
import './styles/global.scss';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount('#app');
```

- [ ] **Step 5: Create frontend/src/App.vue**

```vue
<template>
  <router-view />
</template>

<script setup lang="ts">
</script>

<style lang="scss">
#app {
  height: 100vh;
  overflow: hidden;
}
</style>
```

- [ ] **Step 6: Create frontend/src/env.d.ts**

```typescript
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
```

- [ ] **Step 7: Install frontend dependencies and verify dev server**

```bash
cd "E:\物业租赁综合管理系统\frontend" && npm install && npx vite --host 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Vue3 frontend with Vite, Element Plus, ECharts"
```

---

### Task 0.5: Initialize Express backend project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/config/index.ts`
- Create: `backend/src/config/database.ts`
- Create: `backend/src/config/redis.ts`

- [ ] **Step 1: Create backend/package.json**

```json
{
  "name": "property-rental-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "npx sequelize-cli db:migrate",
    "db:seed": "npx sequelize-cli db:seed:all",
    "db:reset": "npx sequelize-cli db:migrate:undo:all && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "sequelize": "^6.37.1",
    "mysql2": "^3.9.1",
    "redis": "^4.6.12",
    "ioredis": "^5.3.2",
    "node-cron": "^3.0.3",
    "multer": "^1.4.5-lts.1",
    "xlsx": "^0.18.5",
    "ws": "^8.16.0",
    "joi": "^17.12.1",
    "express-rate-limit": "^7.1.5",
    "node-cache": "^5.1.2",
    "dayjs": "^1.11.10",
    "uuid": "^9.0.1",
    "dotenv": "^16.4.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/multer": "^1.4.11",
    "@types/ws": "^8.5.10",
    "@types/node-cron": "^3.0.11",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "tsx": "^4.7.1",
    "@types/node": "^20.11.16"
  }
}
```

- [ ] **Step 2: Create backend/src/config/index.ts**

```typescript
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'property_rental',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: 'mysql' as const,
    logging: process.env.NODE_ENV === 'development',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'property-rental-jwt-secret-key',
    accessExpiry: '4h',
    refreshExpiry: '7d',
  },
  upload: {
    dir: path.join(__dirname, '../../uploads'),
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
};
```

- [ ] **Step 3: Create backend/src/config/database.ts**

```typescript
import { Sequelize } from 'sequelize';
import { config } from './index';

export const sequelize = new Sequelize({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  username: config.db.username,
  password: config.db.password,
  dialect: config.db.dialect,
  logging: config.db.logging ? console.log : false,
  timezone: '+08:00',
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timestamps: true,
    underscored: false,
    paranoid: false,
  },
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
});

export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}
```

- [ ] **Step 4: Create backend/src/config/redis.ts**

```typescript
import Redis from 'ioredis';
import { config } from './index';

let redis: Redis;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    redis.on('connect', () => console.log('Redis connected.'));
    redis.on('error', (err) => console.error('Redis error:', err));
  }
  return redis;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const r = getRedis();
  await r.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const r = getRedis();
  const data = await r.get(key);
  return data ? JSON.parse(data) : null;
}

export async function clearCache(pattern: string): Promise<void> {
  const r = getRedis();
  const keys = await r.keys(pattern);
  if (keys.length > 0) {
    await r.del(...keys);
  }
}
```

- [ ] **Step 5: Create backend/src/app.ts**

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import routes from './routes';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ['http://localhost:5173', 'file://'], credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimitMiddleware);
app.use('/api', routes);
app.use(errorHandler);

export default app;
```

- [ ] **Step 6: Create backend/src/index.ts**

```typescript
import app from './app';
import { config } from './config';
import { sequelize, connectDatabase } from './config/database';
import './models'; // Register all model associations
import { scheduler } from './jobs/scheduler';
import { setupWebSocket } from './websocket';
import http from 'http';

async function start() {
  await connectDatabase();
  await sequelize.sync({ alter: false });

  const server = http.createServer(app);
  setupWebSocket(server);

  scheduler.start();

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

- [ ] **Step 7: Install backend dependencies**

```bash
cd "E:\物业租赁综合管理系统\backend" && npm install
```

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: initialize Express backend with Sequelize, Redis, middleware"
```

---

### Task 0.6: Create middleware stack

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/middleware/rbac.ts`
- Create: `backend/src/middleware/validate.ts`
- Create: `backend/src/middleware/rate-limiter.ts`
- Create: `backend/src/middleware/audit-log.ts`
- Create: `backend/src/middleware/error-handler.ts`

- [ ] **Step 1: Create backend/src/middleware/auth.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  role?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录或Token已过期' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: number; username: string; role: string;
    };
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: 'Token无效或已过期' });
  }
}
```

- [ ] **Step 2: Create backend/src/middleware/rbac.ts**

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

const rolePermissions: Record<string, Record<string, PermissionAction[]>> = {
  '管理员': { '*': ['create', 'read', 'update', 'delete', 'approve', 'export'] },
  '收租主管': { 'rent': ['create', 'read', 'update', 'delete', 'approve', 'export'],
               'tenant': ['create', 'read', 'update', 'delete', 'export'],
               'contract': ['read'] },
  '收租员': { 'rent': ['create', 'read', 'update', 'export'],
             'tenant': ['create', 'read', 'update'] },
  '财务主管': { 'finance': ['create', 'read', 'update', 'delete', 'approve', 'export'],
               'reports': ['read', 'export'] },
  '会计': { 'finance': ['create', 'read', 'update', 'export'],
          'reports': ['read'] },
  '出纳': { 'finance': ['read', 'update'], 'rent': ['read'] },
  '合同主管': { 'contract': ['create', 'read', 'update', 'delete', 'approve', 'export'],
               'tenant': ['read'] },
  '法务': { 'contract': ['read', 'approve'], 'compliance': ['read', 'update', 'approve', 'export'] },
  '总经理': { '*': ['read', 'approve', 'export'] },
};

export function requirePermission(module: string, action: PermissionAction) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.role || '';
    const perms = rolePermissions[role];
    if (!perms) return res.status(403).json({ code: 403, message: '权限不足' });
    const modulePerms = perms['*'] || perms[module] || [];
    if (!modulePerms.includes(action)) {
      return res.status(403).json({ code: 403, message: '权限不足' });
    }
    next();
  };
}
```

- [ ] **Step 3: Create backend/src/middleware/validate.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

type SchemaMap = {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
};

export function validate(schemas: SchemaMap) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const { error } = schemas.body.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          code: 400,
          message: '参数校验失败',
          errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
        });
      }
    }
    if (schemas.query) {
      const { error } = schemas.query.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          code: 400,
          message: '查询参数校验失败',
          errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
        });
      }
    }
    if (schemas.params) {
      const { error } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          code: 400,
          message: '路径参数校验失败',
          errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
        });
      }
    }
    next();
  };
}
```

- [ ] **Step 4: Create backend/src/middleware/rate-limiter.ts**

```typescript
import rateLimit from 'express-rate-limit';

export const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

- [ ] **Step 5: Create backend/src/middleware/audit-log.ts**

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import AuditLog from '../models/AuditLog';

export function auditLog(module: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400 && req.userId) {
        AuditLog.create({
          userId: req.userId,
          action,
          module,
          targetType: req.baseUrl,
          targetId: req.params.id || '',
          detail: JSON.stringify({ method: req.method, path: req.path }),
          ip: req.ip || '',
        }).catch((err) => console.error('Audit log error:', err));
      }
      return originalJson(body);
    };
    next();
  };
}
```

- [ ] **Step 6: Create backend/src/middleware/error-handler.ts**

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    code: status,
    message: err.message || '服务器内部错误',
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/
git commit -m "feat: add auth, RBAC, validation, rate limiting, audit, and error handling middleware"
```

---

### Task 0.7: Define all Sequelize models with associations

**Files:**
- Create: `backend/src/models/index.ts`
- Create: `backend/src/models/User.ts`
- Create: `backend/src/models/Property.ts`
- Create: `backend/src/models/Tenant.ts`
- Create: `backend/src/models/Contract.ts`
- Create: `backend/src/models/Bill.ts`
- Create: `backend/src/models/PaymentRecord.ts`
- Create: `backend/src/models/Voucher.ts`
- Create: `backend/src/models/VoucherEntry.ts`
- Create: `backend/src/models/AccountBook.ts`
- Create: `backend/src/models/ChartOfAccount.ts`
- Create: `backend/src/models/Budget.ts`
- Create: `backend/src/models/Expense.ts`
- Create: `backend/src/models/FixedAsset.ts`
- Create: `backend/src/models/ContractTemplate.ts`
- Create: `backend/src/models/ContractClause.ts`
- Create: `backend/src/models/ContractChange.ts`
- Create: `backend/src/models/ContractLog.ts`
- Create: `backend/src/models/Approval.ts`
- Create: `backend/src/models/DunningTask.ts`
- Create: `backend/src/models/Notification.ts`
- Create: `backend/src/models/AuditLog.ts`
- Create: `backend/src/models/DictType.ts`
- Create: `backend/src/models/DictItem.ts`
- Create: `backend/src/models/SystemConfig.ts`

- [ ] **Step 1: Create backend/src/models/User.ts**

```typescript
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcryptjs';

interface UserAttributes {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  role: string;
  permissions: object;
  lastLogin: Date | null;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserCreationAttributes = Optional<UserAttributes, 'id' | 'lastLogin' | 'createdAt' | 'updatedAt'>;

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public passwordHash!: string;
  public displayName!: string;
  public role!: string;
  public permissions!: object;
  public lastLogin!: Date | null;
  public status!: string;

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}

User.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  displayName: { type: DataTypes.STRING(50), allowNull: false },
  role: {
    type: DataTypes.ENUM('管理员','收租主管','收租员','财务主管','会计','出纳','合同主管','法务','总经理'),
    allowNull: false,
  },
  permissions: { type: DataTypes.JSON, defaultValue: {} },
  lastLogin: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(20), defaultValue: '正常' },
}, {
  sequelize,
  tableName: 'users',
});

export default User;
```

- [ ] **Step 2: Create backend/src/models/Property.ts**

```typescript
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PropertyAttributes {
  id: number; name: string; type: '公寓'|'厂房'|'商铺'; subType: string;
  area: number; address: string; floor: string; unit: string;
  status: '空置'|'已预订'|'已出租'|'维修中'|'退租中';
  amenities: object; owner: string; notes: string; deletedAt: Date | null;
  createdAt?: Date; updatedAt?: Date;
}

type PropertyCreationAttributes = Optional<PropertyAttributes, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>;

class Property extends Model<PropertyAttributes, PropertyCreationAttributes> implements PropertyAttributes {
  public id!: number; public name!: string; public type!: '公寓'|'厂房'|'商铺';
  public subType!: string; public area!: number; public address!: string;
  public floor!: string; public unit!: string;
  public status!: '空置'|'已预订'|'已出租'|'维修中'|'退租中';
  public amenities!: object; public owner!: string; public notes!: string;
  public deletedAt!: Date | null;
}

Property.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('公寓','厂房','商铺'), allowNull: false },
  subType: { type: DataTypes.STRING(50), defaultValue: '' },
  area: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  address: { type: DataTypes.STRING(255), defaultValue: '' },
  floor: { type: DataTypes.STRING(20), defaultValue: '' },
  unit: { type: DataTypes.STRING(20), defaultValue: '' },
  status: { type: DataTypes.ENUM('空置','已预订','已出租','维修中','退租中'), defaultValue: '空置' },
  amenities: { type: DataTypes.JSON, defaultValue: {} },
  owner: { type: DataTypes.STRING(100), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize, tableName: 'properties',
  paranoid: true, deletedAt: 'deletedAt',
  indexes: [{ fields: ['type'] }, { fields: ['status'] }, { fields: ['name'] }],
});

export default Property;
```

The remaining model files follow the same pattern. Let me define models/index.ts to aggregate all and set up associations.

- [ ] **Step 3: Create backend/src/models/index.ts with all models and associations**

```typescript
import User from './User';
import Property from './Property';
import Tenant from './Tenant';
import Contract from './Contract';
import Bill from './Bill';
import PaymentRecord from './PaymentRecord';
import Voucher from './Voucher';
import VoucherEntry from './VoucherEntry';
import AccountBook from './AccountBook';
import ChartOfAccount from './ChartOfAccount';
import Budget from './Budget';
import Expense from './Expense';
import FixedAsset from './FixedAsset';
import ContractTemplate from './ContractTemplate';
import ContractClause from './ContractClause';
import ContractChange from './ContractChange';
import ContractLog from './ContractLog';
import Approval from './Approval';
import DunningTask from './DunningTask';
import Notification from './Notification';
import AuditLog from './AuditLog';

// Property <-> Contract
Property.hasMany(Contract, { foreignKey: 'propertyId', as: 'contracts' });
Contract.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Tenant <-> Contract
Tenant.hasMany(Contract, { foreignKey: 'tenantId', as: 'contracts' });
Contract.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// Contract <-> Bill
Contract.hasMany(Bill, { foreignKey: 'contractId', as: 'bills' });
Bill.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// Bill <-> PaymentRecord
Bill.hasMany(PaymentRecord, { foreignKey: 'billId', as: 'paymentRecords' });
PaymentRecord.belongsTo(Bill, { foreignKey: 'billId', as: 'bill' });

// Bill <-> DunningTask
Bill.hasMany(DunningTask, { foreignKey: 'billId', as: 'dunningTasks' });
DunningTask.belongsTo(Bill, { foreignKey: 'billId', as: 'bill' });

// AccountBook <-> ChartOfAccount
AccountBook.hasMany(ChartOfAccount, { foreignKey: 'bookId', as: 'accounts' });
ChartOfAccount.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

// ChartOfAccount self-reference (parent-child)
ChartOfAccount.belongsTo(ChartOfAccount, { foreignKey: 'parentId', as: 'parent' });
ChartOfAccount.hasMany(ChartOfAccount, { foreignKey: 'parentId', as: 'children' });

// AccountBook <-> Voucher
AccountBook.hasMany(Voucher, { foreignKey: 'bookId', as: 'vouchers' });
Voucher.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

// Voucher <-> VoucherEntry
Voucher.hasMany(VoucherEntry, { foreignKey: 'voucherId', as: 'entries' });
VoucherEntry.belongsTo(Voucher, { foreignKey: 'voucherId', as: 'voucher' });

// ChartOfAccount <-> VoucherEntry
ChartOfAccount.hasMany(VoucherEntry, { foreignKey: 'accountId', as: 'entries' });
VoucherEntry.belongsTo(ChartOfAccount, { foreignKey: 'accountId', as: 'account' });

// Contract <-> Approval
Contract.hasMany(Approval, { foreignKey: 'contractId', as: 'approvals' });
Approval.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// User references
User.hasMany(Voucher, { foreignKey: 'createdBy', as: 'createdVouchers' });
User.hasMany(Approval, { foreignKey: 'approverId', as: 'approvals' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
User.hasMany(Budget, { foreignKey: 'createdBy', as: 'createdBudgets' });
User.hasMany(Contract, { foreignKey: 'createdBy', as: 'createdContracts' });

// ContractTemplate <-> ContractClause
ContractTemplate.hasMany(ContractClause, { foreignKey: 'templateId', as: 'clauses' });
ContractClause.belongsTo(ContractTemplate, { foreignKey: 'templateId', as: 'template' });

// ContractTemplate <-> Contract
ContractTemplate.hasMany(Contract, { foreignKey: 'templateId', as: 'contracts' });
Contract.belongsTo(ContractTemplate, { foreignKey: 'templateId', as: 'template' });

// Contract <-> ContractChange
Contract.hasMany(ContractChange, { foreignKey: 'contractId', as: 'changes' });
ContractChange.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// Contract <-> ContractLog
Contract.hasMany(ContractLog, { foreignKey: 'contractId', as: 'logs' });
ContractLog.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// AccountBook <-> Budget
AccountBook.hasMany(Budget, { foreignKey: 'bookId', as: 'budgets' });
Budget.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });
Budget.belongsTo(ChartOfAccount, { foreignKey: 'accountId', as: 'account' });

// AccountBook <-> Expense
AccountBook.hasMany(Expense, { foreignKey: 'bookId', as: 'expenses' });
Expense.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

// AccountBook <-> FixedAsset
AccountBook.hasMany(FixedAsset, { foreignKey: 'bookId', as: 'fixedAssets' });
FixedAsset.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

export {
  User, Property, Tenant, Contract, Bill, PaymentRecord,
  Voucher, VoucherEntry, AccountBook, ChartOfAccount,
  Budget, Expense, FixedAsset, ContractTemplate, ContractClause,
  ContractChange, ContractLog, Approval, DunningTask,
  Notification, AuditLog,
};
```

For the remaining models (Tenant, Contract, Bill, PaymentRecord, Voucher, VoucherEntry, AccountBook, ChartOfAccount, Budget, Expense, FixedAsset, ContractTemplate, ContractClause, ContractChange, ContractLog, Approval, DunningTask, Notification, AuditLog), create each file following the same pattern as User.ts and Property.ts, matching the schema from the design spec.

The complete model code for all 22 models would be created. Each follows this template:

```typescript
// Example: Tenant.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface TenantAttributes { id: number; name: string; idType: '身份证'|'营业执照'|'护照'; ... }
type TenantCreationAttributes = Optional<TenantAttributes, 'id' | ...>;

class Tenant extends Model<TenantAttributes, TenantCreationAttributes> implements TenantAttributes {
  public id!: number; public name!: string; ...
}

Tenant.init({ ... }, { sequelize, tableName: 'tenants', indexes: [...] });
export default Tenant;
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/
git commit -m "feat: define all 22 Sequelize models with associations"
```

---

### Task 0.8: Create route aggregator, auth, and basic routes

**Files:**
- Create: `backend/src/routes/index.ts`
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/routes/dashboard.ts`

- [ ] **Step 1: Create backend/src/routes/index.ts**

```typescript
import { Router } from 'express';
import authRoutes from './auth';
import propertyRoutes from './properties';
import tenantRoutes from './tenants';
import billRoutes from './bills';
import paymentRecordRoutes from './paymentRecords';
import dunningRoutes from './dunning';
import voucherRoutes from './vouchers';
import accountBookRoutes from './accountBooks';
import accountRoutes from './accounts';
import expenseRoutes from './expenses';
import taxRoutes from './tax';
import budgetRoutes from './budgets';
import reportRoutes from './reports';
import contractRoutes from './contracts';
import contractTemplateRoutes from './contractTemplates';
import approvalRoutes from './approvals';
import complianceRoutes from './compliance';
import dashboardRoutes from './dashboard';
import userRoutes from './users';
import dictRoutes from './dicts';
import auditLogRoutes from './auditLogs';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/properties', authMiddleware, propertyRoutes);
router.use('/tenants', authMiddleware, tenantRoutes);
router.use('/bills', authMiddleware, billRoutes);
router.use('/payment-records', authMiddleware, paymentRecordRoutes);
router.use('/dunning', authMiddleware, dunningRoutes);
router.use('/vouchers', authMiddleware, voucherRoutes);
router.use('/account-books', authMiddleware, accountBookRoutes);
router.use('/accounts', authMiddleware, accountRoutes);
router.use('/expenses', authMiddleware, expenseRoutes);
router.use('/tax', authMiddleware, taxRoutes);
router.use('/budgets', authMiddleware, budgetRoutes);
router.use('/reports', authMiddleware, reportRoutes);
router.use('/contracts', authMiddleware, contractRoutes);
router.use('/contract-templates', authMiddleware, contractTemplateRoutes);
router.use('/approvals', authMiddleware, approvalRoutes);
router.use('/compliance', authMiddleware, complianceRoutes);
router.use('/users', authMiddleware, userRoutes);
router.use('/dicts', authMiddleware, dictRoutes);
router.use('/audit-logs', authMiddleware, auditLogRoutes);

export default router;
```

- [ ] **Step 2: Create backend/src/routes/auth.ts**

```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import User from '../models/User';
import { validate } from '../middleware/validate';
import Joi from 'joi';

const router = Router();

const loginSchema = { body: Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
})};

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username, status: '正常' } });
    if (!user) return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    const valid = await user.validatePassword(password);
    if (!valid) return res.status(401).json({ code: 401, message: '用户名或密码错误' });

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret, { expiresIn: config.jwt.accessExpiry }
    );
    const refreshToken = jwt.sign(
      { userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.refreshExpiry }
    );

    await user.update({ lastLogin: new Date() });

    res.json({
      code: 200,
      data: {
        accessToken, refreshToken,
        user: { id: user.id, username: user.username, displayName: user.displayName,
                role: user.role, permissions: user.permissions },
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, config.jwt.secret) as { userId: number };
    const user = await User.findByPk(decoded.userId);
    if (!user) return res.status(401).json({ code: 401, message: '用户不存在' });
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret, { expiresIn: config.jwt.accessExpiry }
    );
    res.json({ code: 200, data: { accessToken } });
  } catch {
    res.status(401).json({ code: 401, message: 'RefreshToken无效' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ code: 200, message: '已退出登录' });
});

export default router;
```

- [ ] **Step 3: Create backend/src/routes/dashboard.ts (stub for now)**

```typescript
import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/rent', (req: AuthRequest, res) => {
  res.json({
    code: 200,
    data: {
      collectionRate: 0, overdueRate: 0, monthlyDue: 0,
      monthlyCollected: 0, arrearsCount: 0,
    },
  });
});

router.get('/finance', (req: AuthRequest, res) => {
  res.json({
    code: 200,
    data: {
      totalRevenue: 0, totalExpense: 0, netProfit: 0,
      profitMargin: 0, taxRate: 0,
    },
  });
});

router.get('/contracts', (req: AuthRequest, res) => {
  res.json({
    code: 200,
    data: {
      totalContracts: 0, activeRate: 0, avgApprovalDays: 0,
      renewalRate: 0, expiringThisMonth: 0,
    },
  });
});

export default router;
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/
git commit -m "feat: add route aggregator, auth endpoints, and dashboard stubs"
```

---

### Task 0.9: Create frontend common infrastructure (API, router, stores, layout)

**Files:**
- Create: `frontend/src/api/request.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/router/index.ts`
- Create: `frontend/src/stores/auth.ts`
- Create: `frontend/src/styles/variables.scss`
- Create: `frontend/src/styles/element-overrides.scss`
- Create: `frontend/src/styles/global.scss`
- Create: `frontend/src/components/layout/AppLayout.vue`
- Create: `frontend/src/components/layout/TopNav.vue`
- Create: `frontend/src/components/layout/Sidebar.vue`
- Create: `frontend/src/components/layout/Breadcrumb.vue`
- Create: `frontend/src/views/dashboard/HomeDashboard.vue`
- Create: `frontend/src/views/Login.vue`

- [ ] **Step 1: Create frontend/src/api/request.ts**

```typescript
import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';

const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

request.interceptors.request.use((config: AxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data.code !== 200 && response.data.code !== undefined) {
      ElMessage.error(response.data.message || '请求失败');
      return Promise.reject(new Error(response.data.message));
    }
    return response.data;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', res.data.data.accessToken);
          error.config.headers['Authorization'] = `Bearer ${res.data.data.accessToken}`;
          return request(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    ElMessage.error(error.response?.data?.message || '网络错误');
    return Promise.reject(error);
  }
);

export default request;
```

- [ ] **Step 2: Create frontend/src/router/index.ts**

```typescript
import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/HomeDashboard.vue'),
        meta: { title: '首页概览', icon: 'HomeFilled' },
      },
      {
        path: 'rent/properties',
        name: 'PropertyList',
        component: () => import('@/views/rent/PropertyList.vue'),
        meta: { title: '房源管理', icon: 'OfficeBuilding' },
      },
      {
        path: 'rent/properties/:id',
        name: 'PropertyDetail',
        component: () => import('@/views/rent/PropertyDetail.vue'),
        meta: { title: '房源详情', hidden: true },
      },
      {
        path: 'rent/properties/import',
        name: 'PropertyImport',
        component: () => import('@/views/rent/PropertyImport.vue'),
        meta: { title: '批量导入', hidden: true },
      },
      {
        path: 'rent/tenants',
        name: 'TenantList',
        component: () => import('@/views/rent/TenantList.vue'),
        meta: { title: '租客管理', icon: 'User' },
      },
      {
        path: 'rent/tenants/:id',
        name: 'TenantDetail',
        component: () => import('@/views/rent/TenantDetail.vue'),
        meta: { title: '租客详情', hidden: true },
      },
      {
        path: 'rent/bills',
        name: 'BillList',
        component: () => import('@/views/rent/BillList.vue'),
        meta: { title: '收租管理', icon: 'Money' },
      },
      {
        path: 'rent/bills/calendar',
        name: 'BillCalendar',
        component: () => import('@/views/rent/BillCalendar.vue'),
        meta: { title: '收租日历', hidden: true },
      },
      {
        path: 'rent/dunning',
        name: 'DunningCenter',
        component: () => import('@/views/rent/DunningCenter.vue'),
        meta: { title: '智能催缴', icon: 'Bell' },
      },
      {
        path: 'rent/dashboard',
        name: 'RentDashboard',
        component: () => import('@/views/rent/RentDashboard.vue'),
        meta: { title: '收租看板', icon: 'DataAnalysis' },
      },
      {
        path: 'finance/books',
        name: 'AccountBookList',
        component: () => import('@/views/finance/AccountBookList.vue'),
        meta: { title: '账套管理', icon: 'Notebook' },
      },
      {
        path: 'finance/accounts',
        name: 'AccountList',
        component: () => import('@/views/finance/AccountList.vue'),
        meta: { title: '科目管理', icon: 'List' },
      },
      {
        path: 'finance/vouchers',
        name: 'VoucherList',
        component: () => import('@/views/finance/VoucherList.vue'),
        meta: { title: '凭证管理', icon: 'Document' },
      },
      {
        path: 'finance/vouchers/edit/:id?',
        name: 'VoucherEdit',
        component: () => import('@/views/finance/VoucherEdit.vue'),
        meta: { title: '凭证编辑', hidden: true },
      },
      {
        path: 'finance/expenses',
        name: 'ExpenseList',
        component: () => import('@/views/finance/ExpenseList.vue'),
        meta: { title: '费用核算', icon: 'CreditCard' },
      },
      {
        path: 'finance/tax',
        name: 'TaxManagement',
        component: () => import('@/views/finance/TaxManagement.vue'),
        meta: { title: '税务管理', icon: 'Stamp' },
      },
      {
        path: 'finance/budgets',
        name: 'BudgetList',
        component: () => import('@/views/finance/BudgetList.vue'),
        meta: { title: '预算管理', icon: 'TrendCharts' },
      },
      {
        path: 'finance/budgets/edit/:id?',
        name: 'BudgetEdit',
        component: () => import('@/views/finance/BudgetEdit.vue'),
        meta: { title: '预算编辑', hidden: true },
      },
      {
        path: 'finance/reports',
        name: 'ReportCenter',
        component: () => import('@/views/finance/ReportCenter.vue'),
        meta: { title: '报表中心', icon: 'Files' },
      },
      {
        path: 'finance/dashboard',
        name: 'FinanceDashboard',
        component: () => import('@/views/finance/FinanceDashboard.vue'),
        meta: { title: '财务看板', icon: 'DataBoard' },
      },
      {
        path: 'contract/list',
        name: 'ContractList',
        component: () => import('@/views/contract/ContractList.vue'),
        meta: { title: '合同管理', icon: 'DocumentChecked' },
      },
      {
        path: 'contract/draft/:id?',
        name: 'ContractDraft',
        component: () => import('@/views/contract/ContractDraft.vue'),
        meta: { title: '合同起草', hidden: true },
      },
      {
        path: 'contract/detail/:id',
        name: 'ContractDetail',
        component: () => import('@/views/contract/ContractDetail.vue'),
        meta: { title: '合同详情', hidden: true },
      },
      {
        path: 'contract/approval',
        name: 'ContractApproval',
        component: () => import('@/views/contract/ContractApproval.vue'),
        meta: { title: '合同审批', icon: 'Checked' },
      },
      {
        path: 'contract/kanban',
        name: 'ContractKanban',
        component: () => import('@/views/contract/ContractKanban.vue'),
        meta: { title: '合同看板', icon: 'Grid' },
      },
      {
        path: 'contract/expiry',
        name: 'ExpiryCalendar',
        component: () => import('@/views/contract/ExpiryCalendar.vue'),
        meta: { title: '到期管理', icon: 'Calendar' },
      },
      {
        path: 'contract/renewals',
        name: 'RenewalList',
        component: () => import('@/views/contract/RenewalList.vue'),
        meta: { title: '续约管理', icon: 'Refresh' },
      },
      {
        path: 'contract/templates',
        name: 'TemplateList',
        component: () => import('@/views/contract/TemplateList.vue'),
        meta: { title: '模板管理', icon: 'Tickets' },
      },
      {
        path: 'contract/compliance',
        name: 'ComplianceReport',
        component: () => import('@/views/contract/ComplianceReport.vue'),
        meta: { title: '合规管理', icon: 'Warning' },
      },
      {
        path: 'contract/dashboard',
        name: 'ContractDashboard',
        component: () => import('@/views/contract/ContractDashboard.vue'),
        meta: { title: '合同看板', icon: 'PieChart' },
      },
      {
        path: 'system/users',
        name: 'UserList',
        component: () => import('@/views/system/UserList.vue'),
        meta: { title: '用户管理', icon: 'UserFilled' },
      },
      {
        path: 'system/dicts',
        name: 'DictList',
        component: () => import('@/views/system/DictList.vue'),
        meta: { title: '数据字典', icon: 'Collection' },
      },
      {
        path: 'system/audit-logs',
        name: 'AuditLog',
        component: () => import('@/views/system/AuditLog.vue'),
        meta: { title: '审计日志', icon: 'Monitor' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('accessToken');
  if (to.meta.requiresAuth !== false && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
```

(Then create the Auth store, design token variables, layout components, login page, and home dashboard. Each file would have the complete code as per the design spec's UI section.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add frontend API layer, router, stores, layout, and login page"
```

---

Phase 0 complete. All foundation code is in place.

---

## Phase 1: Rent Collection Module

### Task 1.1: Backend — Properties CRUD routes

**Files:**
- Create: `backend/src/routes/properties.ts`

- [ ] **Step 1: Create properties route file**

```typescript
import { Router } from 'express';
import Property from '../models/Property';
import { AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import Joi from 'joi';
import { Op } from 'sequelize';
import * as XLSX from 'xlsx';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

const propertySchema = {
  body: Joi.object({
    name: Joi.string().required().max(100),
    type: Joi.string().valid('公寓','厂房','商铺').required(),
    subType: Joi.string().allow('').max(50),
    area: Joi.number().required().min(0),
    address: Joi.string().allow('').max(255),
    floor: Joi.string().allow('').max(20),
    unit: Joi.string().allow('').max(20),
    status: Joi.string().valid('空置','已预订','已出租','维修中','退租中'),
    amenities: Joi.object().default({}),
    owner: Joi.string().allow('').max(100),
    notes: Joi.string().allow(''),
  }),
};

// GET /api/properties — List with search, filter, pagination
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, type, status } = req.query;
    const where: any = {};
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { address: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (type) where.type = type;
    if (status) where.status = status;

    const { count, rows } = await Property.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });

    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/properties — Create
router.post('/', validate(propertySchema), async (req: AuthRequest, res) => {
  try {
    const property = await Property.create(req.body);
    res.json({ code: 200, data: property, message: '房源创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/:id — Detail
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    res.json({ code: 200, data: property });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/properties/:id — Update
router.put('/:id', validate(propertySchema), async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    await property.update(req.body);
    res.json({ code: 200, data: property, message: '房源更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /api/properties/:id — Soft delete
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    await property.destroy();
    res.json({ code: 200, message: '房源已删除' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PATCH /api/properties/:id/status — Status transition
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['空置','已预订','已出租','维修中','退租中'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ code: 400, message: '无效的房源状态' });
    }
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    await property.update({ status });
    res.json({ code: 200, data: property, message: '状态更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/properties/import — Excel import
router.post('/import', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传Excel文件' });
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    const created: Property[] = [];
    for (const row of rows) {
      const property = await Property.create({
        name: row['名称'] || row['name'] || '',
        type: row['类型'] || row['type'] || '公寓',
        area: Number(row['面积'] || row['area'] || 0),
        address: row['地址'] || row['address'] || '',
        floor: row['楼层'] || row['floor'] || '',
        unit: row['单元'] || row['unit'] || '',
        subType: row['子类型'] || row['subType'] || '',
        amenities: row['设施'] ? JSON.parse(row['设施']) : {},
      });
      created.push(property);
    }
    res.json({ code: 200, data: { imported: created.length }, message: `成功导入${created.length}条房源` });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/properties.ts
git commit -m "feat: add Property CRUD routes with search, import, and status management"
```

---

### Task 1.2: Frontend — PropertyList.vue

**Files:**
- Create: `frontend/src/views/rent/PropertyList.vue`
- Create: `frontend/src/api/properties.ts`

- [ ] **Step 1: Create property API module**

```typescript
// frontend/src/api/properties.ts
import request from './request';

export interface Property {
  id: number; name: string; type: string; subType: string;
  area: number; address: string; floor: string; unit: string;
  status: string; amenities: any; owner: string; notes: string;
  createdAt: string; updatedAt: string;
}

export async function getProperties(params: any) {
  return request.get('/properties', { params });
}

export async function getProperty(id: number) {
  return request.get(`/properties/${id}`);
}

export async function createProperty(data: Partial<Property>) {
  return request.post('/properties', data);
}

export async function updateProperty(id: number, data: Partial<Property>) {
  return request.put(`/properties/${id}`, data);
}

export async function deleteProperty(id: number) {
  return request.delete(`/properties/${id}`);
}

export async function updatePropertyStatus(id: number, status: string) {
  return request.patch(`/properties/${id}/status`, { status });
}

export async function importProperties(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/properties/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
```

- [ ] **Step 2: Create PropertyList.vue**

Create the full PropertyList component with: el-table for listing, el-input for keyword search, el-select for type/status filter, el-button for create/import/delete, el-pagination, el-dialog for create/edit form. Use Element Plus UI following the design spec color scheme.

```vue
<template>
  <div class="property-list">
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索房源名称/地址" clearable style="width:220px" @keyup.enter="fetchData" />
        <el-select v-model="filterType" placeholder="业态类型" clearable style="width:130px" @change="fetchData">
          <el-option label="公寓" value="公寓" />
          <el-option label="厂房" value="厂房" />
          <el-option label="商铺" value="商铺" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option label="空置" value="空置" />
          <el-option label="已预订" value="已预订" />
          <el-option label="已出租" value="已出租" />
          <el-option label="维修中" value="维修中" />
          <el-option label="退租中" value="退租中" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog()">新增房源</el-button>
        <el-button @click="$router.push('/rent/properties/import')">批量导入</el-button>
      </div>
    </div>
    <el-table :data="tableData" stripe v-loading="loading" @row-click="(row: any) => $router.push(`/rent/properties/${row.id}`)" style="cursor:pointer">
      <el-table-column prop="name" label="房源名称" width="180" />
      <el-table-column prop="type" label="业态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === '公寓' ? '' : row.type === '厂房' ? 'warning' : 'success'" size="small">{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="area" label="面积(㎡)" width="100" />
      <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="floor" label="楼层" width="80" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click.stop="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该房源?" @confirm="handleDelete(row.id)">
            <template #reference>
              <el-button size="small" type="danger" @click.stop>删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" />
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px" @closed="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="房源名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="业态类型" prop="type"><el-select v-model="form.type" style="width:100%"><el-option label="公寓" value="公寓" /><el-option label="厂房" value="厂房" /><el-option label="商铺" value="商铺" /></el-select></el-form-item>
        <el-form-item label="子类型" prop="subType"><el-input v-model="form.subType" /></el-form-item>
        <el-form-item label="面积(㎡)" prop="area"><el-input-number v-model="form.area" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="地址" prop="address"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="楼层" prop="floor"><el-input v-model="form.floor" /></el-form-item>
        <el-form-item label="单元" prop="unit"><el-input v-model="form.unit" /></el-form-item>
        <el-form-item label="状态" prop="status"><el-select v-model="form.status" style="width:100%"><el-option label="空置" value="空置" /><el-option label="已预订" value="已预订" /><el-option label="已出租" value="已出租" /></el-select></el-form-item>
        <el-form-item label="业主" prop="owner"><el-input v-model="form.owner" /></el-form-item>
        <el-form-item label="备注" prop="notes"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>
```

(The complete Vue component includes script setup with Property API calls, pagination state, form validation rules, CRUD handlers, and the full template as shown above.)

- [ ] **Step 3: Run dev server to verify**

```bash
cd "E:\物业租赁综合管理系统\frontend" && npx vite
```

Open http://localhost:5173, login, navigate to 房源管理. Verify: table renders, search/filter works, create/edit dialog opens, pagination functions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/properties.ts frontend/src/views/rent/PropertyList.vue
git commit -m "feat: add PropertyList with CRUD, search, filter, and pagination"
```

---

### Task 1.3: Frontend — PropertyDetail.vue + PropertyImport.vue

**Files:**
- Create: `frontend/src/views/rent/PropertyDetail.vue`
- Create: `frontend/src/views/rent/PropertyImport.vue`

- [ ] **Step 1: Create PropertyDetail.vue**

Full detail page with: property info card (el-descriptions), tabs for: contracts list (el-table linked to this property), bill history, status change button (el-dropdown with status options), back button.

```vue
<template>
  <div class="property-detail">
    <el-page-header @back="$router.back()" :title="property?.name || '房源详情'" />
    <el-card class="info-card">
      <template #header><span>基本信息</span><el-tag :type="statusTagType(property?.status)" style="margin-left:12px">{{ property?.status }}</el-tag></template>
      <el-descriptions :column="3">
        <el-descriptions-item label="房源名称">{{ property?.name }}</el-descriptions-item>
        <el-descriptions-item label="业态类型">{{ property?.type }}</el-descriptions-item>
        <el-descriptions-item label="面积">{{ property?.area }} ㎡</el-descriptions-item>
        <el-descriptions-item label="地址">{{ property?.address }}</el-descriptions-item>
        <el-descriptions-item label="楼层">{{ property?.floor }}</el-descriptions-item>
        <el-descriptions-item label="单元">{{ property?.unit }}</el-descriptions-item>
        <el-descriptions-item label="业主">{{ property?.owner }}</el-descriptions-item>
        <el-descriptions-item label="子类型">{{ property?.subType }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ property?.notes }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
    <el-card>
      <template #header>关联合同</template>
      <el-table :data="contracts" stripe>
        <el-table-column prop="contractNo" label="合同编号" />
        <el-table-column prop="tenant.name" label="租客" />
        <el-table-column prop="rentAmount" label="月租金" />
        <el-table-column prop="startDate" label="开始日期" />
        <el-table-column prop="endDate" label="结束日期" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
```

(Script setup: fetch property & related contracts on mount via API calls to `/properties/:id` and `/contracts?propertyId=`)

- [ ] **Step 2: Create PropertyImport.vue**

Page with: file upload (el-upload with drag-drop), field mapping (el-select pairs for Excel column → System field), preview table (el-table showing parsed rows before import), import button that calls `importProperties()`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/rent/PropertyDetail.vue frontend/src/views/rent/PropertyImport.vue
git commit -m "feat: add PropertyDetail and PropertyImport views"
```

---

### Task 1.4: Backend — Tenants routes + credit scoring

**Files:**
- Create: `backend/src/routes/tenants.ts`
- Create: `backend/src/services/credit-scorer.ts`
- Create: `backend/src/models/Tenant.ts` (if not done in Phase 0)

- [ ] **Step 1: Create credit scoring service**

```typescript
// backend/src/services/credit-scorer.ts
import Tenant from '../models/Tenant';
import PaymentRecord from '../models/PaymentRecord';
import Bill from '../models/Bill';
import { Op } from 'sequelize';

export async function calculateCreditScore(tenantId: number): Promise<{ score: number; grade: string }> {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('租客不存在');

  // Count on-time payments (weight 40%)
  const totalBills = await Bill.count({ where: { '$contract.tenantId$': tenantId } as any,
    include: [{ association: 'contract', where: { tenantId }, attributes: [] }] });
  const onTimePayments = await PaymentRecord.count({
    where: { createdAt: { [Op.lte]: new Date() } },
    include: [{ model: Bill, as: 'bill', required: true,
      where: {},
      include: [{ association: 'contract', where: { tenantId }, attributes: [] }] }],
  });
  const paymentScore = totalBills > 0 ? (onTimePayments / totalBills) * 40 : 20;

  // Contract fulfillment (weight 25%) — based on contract completion without breach
  const contractScore = 20; // default, adjusted by contract events

  // Property cooperation (weight 20%) — manual rating
  const cooperationScore = 15; // default

  // Late payment history (weight 15%, reverse scored)
  const latePenalty = 5; // reduced per incident

  const totalScore = Math.min(100, Math.max(0, paymentScore + contractScore + cooperationScore - latePenalty));

  const grade = totalScore >= 80 ? 'A' : totalScore >= 60 ? 'B' : totalScore >= 40 ? 'C' : 'D';

  await tenant.update({ creditScore: totalScore, creditGrade: grade });
  return { score: totalScore, grade };
}
```

- [ ] **Step 2: Create tenants route file** with all endpoints from the spec (GET list, POST create, GET/:id detail, PUT/:id update, POST/:id/check-in, POST/:id/check-out). Full code similar to properties route pattern, ~150 lines.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/tenants.ts backend/src/services/credit-scorer.ts
git commit -m "feat: add Tenant routes and credit scoring engine"
```

---

### Task 1.5: Frontend — TenantList.vue + TenantDetail.vue

**Files:**
- Create: `frontend/src/api/tenants.ts`
- Create: `frontend/src/views/rent/TenantList.vue`
- Create: `frontend/src/views/rent/TenantDetail.vue`

- [ ] **Step 1: Create tenant API module** — following the same pattern as `frontend/src/api/properties.ts` with functions: getTenants, getTenant, createTenant, updateTenant, deleteTenant, checkIn, checkOut.

- [ ] **Step 2: Create TenantList.vue** — table with search by name/phone, filter by credit_grade, columns: name, id_number (masked), phone, credit_score with color-coded grade badge, status, actions (edit/delete/detail).

- [ ] **Step 3: Create TenantDetail.vue** — el-descriptions for personal info, tabs for: active contracts, payment history (el-timeline), credit score history (mini chart), attachments (el-upload gallery).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/tenants.ts frontend/src/views/rent/TenantList.vue frontend/src/views/rent/TenantDetail.vue
git commit -m "feat: add TenantList and TenantDetail with credit score display"
```

---

### Task 1.6: Backend — Bills routes + bill generation service

**Files:**
- Create: `backend/src/routes/bills.ts`
- Create: `backend/src/services/bill-generator.ts`

- [ ] **Step 1: Create bill generator service** — scans active contracts daily, calculates next bill date based on payment_cycle (monthly/quarterly/yearly), creates bill record with rent_amount + utility_amount from meter readings, handles tiered and revenue-share modes. ~120 lines.

- [ ] **Step 2: Create bills route** — GET list with tenant/property/status/period filters, POST generate for manual trigger, GET/:id detail with payment records, PUT/:id update, POST/:id/pay to record payment, GET/calendar returning month data (days with status counts). ~180 lines.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/bills.ts backend/src/services/bill-generator.ts
git commit -m "feat: add Bill routes and auto-generation service"
```

---

### Task 1.7: Frontend — BillList.vue + BillCalendar.vue

**Files:**
- Create: `frontend/src/api/bills.ts`
- Create: `frontend/src/views/rent/BillList.vue`
- Create: `frontend/src/views/rent/BillCalendar.vue`

- [ ] **Step 1: Create bill API module and BillList.vue** — table with columns: bill_no, period, tenant name (via contract), total_amount, due_date, status with color-coded tags (未缴=red, 部分缴=orange, 已缴=green, 逾期=dark-red), actions (pay button opening payment dialog, detail link).

- [ ] **Step 2: Create BillCalendar.vue** — el-calendar with custom cell rendering: each day shows count of bills due, color-coded by collection status. Click day opens bill list for that date in a drawer.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/bills.ts frontend/src/views/rent/BillList.vue frontend/src/views/rent/BillCalendar.vue
git commit -m "feat: add BillList and BillCalendar views"
```

---

### Task 1.8: Backend — Payment recording + reconciliation service

**Files:**
- Create: `backend/src/routes/paymentRecords.ts`
- Create: `backend/src/services/payment-reconciler.ts`

- [ ] **Step 1: Create payment reconciler** — FIFO matching: when payment received, find earliest unpaid bill for the tenant's contract, apply payment amount, mark bill partial/paid, update contract rent schedule, trigger credit score recalculation and auto-voucher generation.

- [ ] **Step 2: Create paymentRecords route** — GET list filterable by bill/tenant/date/channel, POST create payment record with auto-reconciliation.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/paymentRecords.ts backend/src/services/payment-reconciler.ts
git commit -m "feat: add payment recording with FIFO reconciliation"
```

---

### Task 1.9: Frontend — PaymentRecord.vue

**Files:**
- Create: `frontend/src/views/rent/PaymentRecord.vue`

- [ ] **Step 1: Create PaymentRecord.vue** — payment history list with date range filter, channel filter. Payment recording dialog: select bill, enter amount, select channel (银行转账/微信/支付宝/现金/POS/支票), enter transaction_no, submit.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/rent/PaymentRecord.vue
git commit -m "feat: add PaymentRecord view"
```

---

### Task 1.10: Backend — Dunning engine service + routes

**Files:**
- Create: `backend/src/services/dunning-engine.ts`
- Create: `backend/src/routes/dunning.ts`

- [ ] **Step 1: Create dunning engine** — checks overdue bills, compares days overdue, creates dunning tasks at appropriate level (level 1: before due, level 2: 1-7 days overdue, level 3: 8-30 days, level 4: 30+ days), dispatches notifications via notification service. Configurable strategy per level (channels, templates, timing).

- [ ] **Step 2: Create dunning routes** — GET/tasks list with filters (level, status, date range), POST/dispatch for manual trigger, PUT/strategy config, GET/aging for arrears aging report (30/60/90/180+ day buckets).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/dunning-engine.ts backend/src/routes/dunning.ts
git commit -m "feat: add multi-level dunning engine and routes"
```

---

### Task 1.11: Frontend — DunningCenter.vue

**Files:**
- Create: `frontend/src/views/rent/DunningCenter.vue`
- Create: `frontend/src/api/dunning.ts`

- [ ] **Step 1: Create DunningCenter.vue** — dashboard-style layout: left panel shows dunning tasks grouped by level (1-4, expandable), right panel shows task detail with bill info, overdue days, channel selection, dispatch button. Bottom section: arrears aging chart (bar chart by 30/60/90/180+ day buckets).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/rent/DunningCenter.vue frontend/src/api/dunning.ts
git commit -m "feat: add DunningCenter with task dispatch and aging analysis"
```

---

### Task 1.12: Frontend — RentDashboard.vue

**Files:**
- Create: `frontend/src/views/rent/RentDashboard.vue`

- [ ] **Step 1: Create RentDashboard.vue** — KPI card row: 当月收缴率, 逾期率, 当月应收, 当月实收, 欠费户数 (el-statistic cards). Row 2: monthly collection trend line chart (应收 vs 实收 vs 欠费, from vue-echarts). Row 3: delinquency rate trend line chart by property type. Row 4: payment channel distribution pie chart. All data from GET /api/dashboard/rent.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/rent/RentDashboard.vue
git commit -m "feat: add RentDashboard with KPI cards and ECharts"
```

---

## Phase 2: Financial Reporting Module

### Task 2.1: Backend — AccountBook routes
**Files:** `backend/src/routes/accountBooks.ts`
- CRUD for account books (多账套管理), accounting period management

### Task 2.2: Backend — ChartOfAccount routes
**Files:** `backend/src/routes/accounts.ts`
- GET tree (parent-child hierarchy), POST create, PUT update, DELETE (if no vouchers reference)

### Task 2.3: Frontend — AccountBookList.vue + AccountList.vue
**Files:** `frontend/src/views/finance/AccountBookList.vue`, `frontend/src/views/finance/AccountList.vue`

### Task 2.4: Backend — Voucher routes + auto-generation service
**Files:** `backend/src/routes/vouchers.ts`, `backend/src/services/voucher-generator.ts`
- Voucher CRUD, auto-generate from bill.paid and expense.approved events, review workflow (草稿→待复核→待审核→已过账)

### Task 2.5: Frontend — VoucherList.vue + VoucherEdit.vue
**Files:** `frontend/src/views/finance/VoucherList.vue`, `frontend/src/views/finance/VoucherEdit.vue`
- Double-entry form with account picker (el-tree-select), debit/credit amount columns with auto-balancing

### Task 2.6: Backend — Expense routes
**Files:** `backend/src/routes/expenses.ts`
- Expense CRUD with category, approval flow, auto-voucher on approval

### Task 2.7: Frontend — ExpenseList.vue
**Files:** `frontend/src/views/finance/ExpenseList.vue`

### Task 2.8: Backend — Tax calculation service + routes
**Files:** `backend/src/services/tax-calculator.ts`, `backend/src/routes/tax.ts`
- VAT calculation (general/small-scale taxpayer), 房产税 (从价/从租), 城镇土地使用税, 印花税, CIT quarterly/annual

### Task 2.9: Frontend — TaxManagement.vue
**Files:** `frontend/src/views/finance/TaxManagement.vue`

### Task 2.10: Backend — Budget routes
**Files:** `backend/src/routes/budgets.ts`
- Budget CRUD with approval flow, execution monitoring with over-budget alerts

### Task 2.11: Frontend — BudgetList.vue + BudgetEdit.vue
**Files:** `frontend/src/views/finance/BudgetList.vue`, `frontend/src/views/finance/BudgetEdit.vue`

### Task 2.12: Backend — Reports engine
**Files:** `backend/src/services/report-engine.ts`, `backend/src/routes/reports.ts`
- Balance sheet, income statement, cash flow statement, management reports. Query voucher_entries aggregated by account.

### Task 2.13: Frontend — ReportCenter.vue
**Files:** `frontend/src/views/finance/ReportCenter.vue`

### Task 2.14: Frontend — FinanceDashboard.vue
**Files:** `frontend/src/views/finance/FinanceDashboard.vue`

---

## Phase 3: Contract Management Module

### Task 3.1: Backend — ContractTemplate routes
**Files:** `backend/src/routes/contractTemplates.ts`
- Template CRUD with clauses (JSON content), default template per property type

### Task 3.2: Frontend — TemplateList.vue
**Files:** `frontend/src/views/contract/TemplateList.vue`

### Task 3.3: Backend — Contract routes (core CRUD + state machine)
**Files:** `backend/src/routes/contracts.ts`, `backend/src/services/contract-workflow.ts`
- Full state machine: draft→submit→approve→sign→active→expiring→expired/terminated

### Task 3.4: Frontend — ContractList.vue
**Files:** `frontend/src/views/contract/ContractList.vue`

### Task 3.5: Frontend — ContractDraft.vue (rich text editor)
**Files:** `frontend/src/views/contract/ContractDraft.vue`
- Uses Tiptap editor, template selector, clause library sidebar, rent calculator widget

### Task 3.6: Frontend — ContractDetail.vue
**Files:** `frontend/src/views/contract/ContractDetail.vue`

### Task 3.7: Backend — Approval routes
**Files:** `backend/src/routes/approvals.ts`
- Multi-level approval workflow, opinion/comments, timeout escalation

### Task 3.8: Frontend — ContractApproval.vue
**Files:** `frontend/src/views/contract/ContractApproval.vue`
- Uses Vue Flow for workflow visualization

### Task 3.9: Frontend — ContractKanban.vue
**Files:** `frontend/src/views/contract/ContractKanban.vue`
- Custom kanban board with drag-drop status columns

### Task 3.10: Backend — Contract change + renewal routes
**Files:** Contract change and renewal logic in contracts routes

### Task 3.11: Frontend — ExpiryCalendar.vue
**Files:** `frontend/src/views/contract/ExpiryCalendar.vue`

### Task 3.12: Frontend — RenewalList.vue
**Files:** `frontend/src/views/contract/RenewalList.vue`

### Task 3.13: Backend — Compliance checker service + routes
**Files:** `backend/src/services/compliance-checker.ts`, `backend/src/routes/compliance.ts`

### Task 3.14: Frontend — ComplianceReport.vue
**Files:** `frontend/src/views/contract/ComplianceReport.vue`

### Task 3.15: Frontend — ContractDashboard.vue
**Files:** `frontend/src/views/contract/ContractDashboard.vue`

---

## Phase 4: External Integrations

### Task 4.1: WeChat Pay callback endpoint
**Files:** `backend/src/routes/paymentCallbacks.ts`
- POST /api/callbacks/wechat-pay — verify signature, match order to bill, reconcile payment

### Task 4.2: Alipay callback endpoint
**Files:** Modify `backend/src/routes/paymentCallbacks.ts`

### Task 4.3: SMS notification service (阿里云SMS)
**Files:** `backend/src/services/notification.ts` — add SMS channel via 阿里云 SDK

### Task 4.4: E-signature integration (e签宝)
**Files:** `backend/src/services/e-signature.ts` — contract signing API

### Task 4.5: Bank reconciliation import
**Files:** `backend/src/services/bank-reconciler.ts` — parse bank statement Excel/CSV

### Task 4.6: Tax export (电子税务局 format)
**Files:** `backend/src/services/tax-exporter.ts` — generate XML/Excel in tax authority format

---

## Phase 5: Polish & Packaging

### Task 5.1: Installer configuration — verify electron-builder.yml, test build
### Task 5.2: Error handling & edge case hardening across all routes
### Task 5.3: UI polish — consistent Element Plus theme, responsive testing at 1280/1440/1920
### Task 5.4: System settings pages (UserList, DictList, AuditLog, RoleConfig)
### Task 5.5: Seed data — default admin user, standard chart of accounts, demo contract templates
**Files:** `backend/seeders/` — seed scripts for initial setup

### Task 5.6: Final integration test — full workflow from property creation through contract signing, bill generation, payment, voucher creation, and report generation

---

**Total: 58 tasks across 6 phases**

