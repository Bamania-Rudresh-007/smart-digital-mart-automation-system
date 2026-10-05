const ApiResponse = require('../utils/apiResponse');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return ApiResponse.error(res, 'Validation error', 400, errorMessages);
    }
    next();
  };
};

module.exports = validate;
