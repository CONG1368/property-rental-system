import app from './app';
import { config } from './config';
import { sequelize, connectDatabase, initAdminUser } from './config/database';
import { setupWebSocket } from './websocket';
import './models';
import http from 'http';

async function start() {
  await connectDatabase();
  await sequelize.sync({ alter: true });
  await initAdminUser();

  const server = http.createServer(app);
  setupWebSocket(server);

  server.listen(config.port, () => {
    console.log('Server running on port ' + config.port);
    console.log('Default login: admin / admin123');
  });
}

start().catch((err) => {
  console.error('');
  console.error('========================================');
  console.error('  Server failed to start');
  console.error('========================================');
  if (err.code === 'ECONNREFUSED') {
    console.error('  MySQL is not running.');
    console.error('  Start it with: net start MySQL80');
    console.error('');
    console.error('  Or if using portable MySQL:');
    console.error('  runtime\\mysql\\bin\\mysqld.exe --standalone');
  } else if (err.code === 'ECONNREFUSED' && err.port === 6379) {
    console.error('  Redis is not running.');
    console.error('  Start it with: redis-server.exe');
  } else {
    console.error('  ' + err.message);
  }
  console.error('========================================');
  process.exit(1);
});
