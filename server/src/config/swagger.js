const swaggerUi = require('swagger-ui-express');

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Smart Digital Mart Automation System (SDMAS) API',
    version: '1.0.0',
    description: 'Production-ready REST API for SDMAS Retail Automation & Inventory System'
  },
  servers: [
    { url: 'http://localhost:5000/api', description: 'Local Development Server' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        summary: 'Authenticate User & Get JWT',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string' }, password: { type: 'string' } },
                required: ['email', 'password']
              }
            }
          }
        },
        responses: { 200: { description: 'Login Successful' } }
      }
    },
    '/products': {
      get: {
        summary: 'Get Store Products List with Real-time Stock',
        responses: { 200: { description: 'Paginated Products' } }
      },
      post: {
        summary: 'Create New Product',
        responses: { 201: { description: 'Product Created' } }
      }
    },
    '/sales/checkout': {
      post: {
        summary: 'Process POS Sale with FEFO Batch Deduction & Stock Ledger update',
        responses: { 201: { description: 'Sale Invoice Generated' } }
      }
    }
  }
};

const setupSwagger = (app) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};

module.exports = setupSwagger;
