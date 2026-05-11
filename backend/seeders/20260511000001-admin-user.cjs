'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const passwordHash = await bcrypt.hash('admin123', 12);
    await queryInterface.bulkInsert('users', [
      {
        username: 'admin',
        passwordHash: passwordHash,
        displayName: '系统管理员',
        role: '管理员',
        permissions: JSON.stringify({}),
        status: '正常',
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { username: 'admin' });
  },
};
