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
  console.error('Failed to start server:', err);
  process.exit(1);
});
