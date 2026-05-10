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
