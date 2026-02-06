const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User');
const { Product, ProductFactory } = require('../src/models/Product');
const Order = require('../src/models/Order');
const Invoice = require('../src/models/Invoice');

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/fincommerce';

const sampleProducts = [
  { name: 'Wireless Headphones', price: 79.99, sku: 'WH-001', category: 'electronics', stock: 150 },
  { name: 'USB-C Hub', price: 49.99, sku: 'UC-001', category: 'electronics', stock: 200 },
  { name: 'Mechanical Keyboard', price: 129.99, sku: 'MK-001', category: 'electronics', stock: 75 },
  { name: 'Standing Desk Mat', price: 39.99, sku: 'SD-001', category: 'office', stock: 300 },
  { name: 'Webcam HD', price: 69.99, sku: 'WC-001', category: 'electronics', stock: 100 },
  { name: 'Code Editor License', price: 99.99, sku: 'CE-001', category: 'software', stock: 999 },
  { name: 'Cloud Hosting Monthly', price: 29.99, sku: 'CH-001', category: 'software', stock: 999 },
  { name: 'Developer T-Shirt', price: 24.99, sku: 'DT-001', category: 'clothing', stock: 500 },
  { name: 'Tech Conference Ticket', price: 299.99, sku: 'TC-001', category: 'events', stock: 50 },
  { name: 'Programming Book Bundle', price: 59.99, sku: 'PB-001', category: 'books', stock: 200 },
];

async function seed() {
  try {
    await mongoose.connect(DATABASE_URL);
    console.log('Connected to database');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      Invoice.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create admin user
    const admin = await User.create({
      email: 'admin@fincommerce.io',
      password: 'Admin@123456',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      emailVerified: true,
      consentGiven: true,
      consentDate: new Date(),
    });
    console.log('Created admin user:', admin.email);

    // Create vendor
    const vendor = await User.create({
      email: 'vendor@fincommerce.io',
      password: 'Vendor@123456',
      firstName: 'Vendor',
      lastName: 'User',
      role: 'vendor',
      emailVerified: true,
      consentGiven: true,
      consentDate: new Date(),
    });

    // Create sample customers
    const customers = [];
    for (let i = 1; i <= 5; i++) {
      const customer = await User.create({
        email: `customer${i}@example.com`,
        password: 'Customer@123',
        firstName: `Customer`,
        lastName: `${i}`,
        phone: `+155512345${i}0`,
        role: 'customer',
        emailVerified: true,
        consentGiven: true,
        consentDate: new Date(),
      });
      customers.push(customer);
    }
    console.log(`Created ${customers.length} customers`);

    // Create products
    const products = [];
    for (const p of sampleProducts) {
      const product = ProductFactory.create('physical', { ...p, vendor: vendor._id });
      await product.save();
      products.push(product);
    }
    console.log(`Created ${products.length} products`);

    // Create sample orders
    for (const customer of customers) {
      const numOrders = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numOrders; i++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const subtotal = product.price * quantity;
        const tax = subtotal * 0.08;

        await Order.create({
          customer: customer._id,
          customerEmail: customer.email,
          shippingAddress: {
            fullName: `${customer.firstName} ${customer.lastName}`,
            street: '123 Main St',
            city: 'TechCity',
            state: 'CA',
            zipCode: '94000',
            country: 'US',
          },
          items: [{
            product: product._id,
            productName: product.name,
            quantity,
            unitPrice: product.price,
            totalPrice: subtotal,
          }],
          subtotal,
          tax,
          total: subtotal + tax,
          status: 'confirmed',
          paymentStatus: 'paid',
        });
      }
    }
    console.log('Created sample orders');

    console.log('\nSeed completed successfully!');
    console.log('Admin login: admin@fincommerce.io / Admin@123456');
    console.log('Vendor login: vendor@fincommerce.io / Vendor@123456');

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
