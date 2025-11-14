const swaggerJsdoc = require('swagger-jsdoc');


const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Inventory Service API',
      version: '1.0.0',
      description: 'Сервіс для управління інвентарем, що надає CRUD операції для пристроїв та фотографій.',
      contact: {
        name: 'Illia Andriichuk',
        url: 'http://localhost:3000',
        email: 'illia.andriichuk@lnu.edu.ua',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`, 
        description: 'Локальний сервер',
      },
    ],
    components: {
      schemas: {
        InventoryItem: {
          type: 'object',
          required: ['inventory_name'],
          properties: {
            ID: {
              type: 'string',
              description: 'Унікальний ідентифікатор інвентарного пристрою',
              readOnly: true,
            },
            inventory_name: {
              type: 'string',
              description: 'Назва інвентарного пристрою',
            },
            description: {
              type: 'string',
              description: 'Опис інвентарного пристрою',
              nullable: true,
            },
            photo_path: {
              type: 'string',
              description: 'Шлях до файлу фотографії на сервері (для внутрішнього використання)',
              readOnly: true,
              nullable: true,
            },
            photo_url: {
              type: 'string',
              description: 'URL для доступу до фотографії пристрою',
              readOnly: true,
              nullable: true,
            },
          },
          example: {
            ID: "1763136130168",
            inventory_name: "ilya",
            description: "Do you wanna see my cat? Of course you do",
            photo_url: "/inventory/1763136130168/photo"
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Повідомлення про помилку',
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./*index.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;