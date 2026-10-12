import ApiResponse from '../utils/apiResponse.js';

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

export default validate;
