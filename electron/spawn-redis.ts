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
