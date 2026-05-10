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
      const initProcess = spawn(mysqlPath, [
        '--initialize-insecure',
        '--datadir=' + dataDir,
      ]);
      initProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('MySQL init failed with code ' + code));
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

  setTimeout(resolve, 5000);

  mysqlProcess.on('error', reject);
}

export function stopMysql() {
  if (mysqlProcess) {
    mysqlProcess.kill('SIGTERM');
    mysqlProcess = null;
  }
}
