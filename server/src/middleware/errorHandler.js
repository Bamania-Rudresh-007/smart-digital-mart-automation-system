import ApiResponse from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.name || 'Error'}: ${err.message}\n${err.stack || ''}`);
  
  if (err.isJoi) {
    return ApiResponse.error(res, 'Validation Error', 400, err.details.map(d => d.message));
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return ApiResponse.error(res, 'Duplicate record entry error', 409, err.errors.map(e => e.message));
  }

  if (err.name === 'SequelizeValidationError') {
    return ApiResponse.error(res, 'Database Validation Error', 400, err.errors.map(e => e.message));
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred on the server';
  return ApiResponse.error(res, message, statusCode);
};

export default errorHandler;
