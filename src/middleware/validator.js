const Joi = require('joi');

// Validation schemas
const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  createProduct: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().max(5000).optional(),
    price: Joi.number().positive().precision(2).required(),
    category: Joi.string().required(),
    sku: Joi.string().alphanum().max(50).required(),
    stock: Joi.number().integer().min(0).required(),
  }),

  createOrder: Joi.object({
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    ).min(1).required(),
    shippingAddress: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required(),
      country: Joi.string().required(),
    }).required(),
  }),

  processPayment: Joi.object({
    orderId: Joi.string().required(),
    paymentMethod: Joi.string().valid('stripe', 'paypal').required(),
    token: Joi.string().when('paymentMethod', {
      is: 'stripe',
      then: Joi.required(),
    }),
  }),

  createInvoice: Joi.object({
    orderId: Joi.string().required(),
    dueDate: Joi.date().greater('now').required(),
    notes: Joi.string().max(1000).optional(),
  }),
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    req.validatedBody = value;
    next();
  };
};

module.exports = { validate, schemas };
