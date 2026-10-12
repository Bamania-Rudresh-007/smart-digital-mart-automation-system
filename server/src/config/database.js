import path from 'node:path';
import { Sequelize } from 'sequelize';
import logger from '../utils/logger.js';
import 'dotenv/config';

const dialect = process.env.DB_DIALECT || 'sqlite';
const isSqlite = dialect === 'sqlite';

if (!['mysql', 'sqlite'].includes(dialect)) {
  throw new Error(`Unsupported DB_DIALECT "${dialect}". Supported values are mysql and sqlite.`);
}

const requiredConfig = isSqlite ? ['DB_NAME'] : ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingConfig = requiredConfig.filter(key => !process.env[key]);
if (missingConfig.length) {
  throw new Error(`Missing required ${isSqlite ? 'SQLite' : 'MySQL'} configuration: ${missingConfig.join(', ')}`);
}

const sequelizeConfig = isSqlite
  ? {
      dialect: 'sqlite',
      storage: path.resolve(process.cwd(), process.env.DB_NAME),
      logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
      define: {
        timestamps: true,
        underscored: true
      }
    }
  : (() => {
      const port = Number(process.env.DB_PORT || 3306);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('DB_PORT must be an integer between 1 and 65535.');
      }

      return {
        host: process.env.DB_HOST,
        port,
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
      };
    })();

const sequelize = isSqlite
  ? new Sequelize({
      ...sequelizeConfig,
      storage: path.resolve(process.cwd(), process.env.DB_NAME)
    })
  : new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, sequelizeConfig);

export default sequelize;
