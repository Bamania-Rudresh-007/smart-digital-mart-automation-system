const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'sqlite';

let sequelize;

if (dialect === 'mysql') {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'sdmas_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || 'rootpassword',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
      pool: {
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true
      }
    }
  );
} else {
  const storagePath = process.env.DB_STORAGE 
    ? path.resolve(process.cwd(), process.env.DB_STORAGE)
    : path.resolve(__dirname, '../../sdmas.sqlite');

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false,
    define: {
      timestamps: true,
      underscored: true
    }
  });
}

module.exports = sequelize;
