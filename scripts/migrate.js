const mongoose = require('mongoose');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/fincommerce';

const migrations = [
  {
    version: 1,
    name: 'create_indexes',
    async up(db) {
      // Users indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ isDeleted: 1 });
      await db.collection('users').createIndex({ role: 1 });

      // Products indexes
      await db.collection('products').createIndex({ sku: 1 }, { unique: true });
      await db.collection('products').createIndex({ category: 1, isActive: 1 });
      await db.collection('products').createIndex({ name: 'text', description: 'text' });

      // Orders indexes
      await db.collection('orders').createIndex({ customer: 1, createdAt: -1 });
      await db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true });
      await db.collection('orders').createIndex({ status: 1 });

      // Invoices indexes
      await db.collection('invoices').createIndex({ invoiceNumber: 1 }, { unique: true });
      await db.collection('invoices').createIndex({ customer: 1 });
      await db.collection('invoices').createIndex({ status: 1, dueDate: 1 });

      // Transactions indexes
      await db.collection('transactions').createIndex({ transactionId: 1 }, { unique: true });
      await db.collection('transactions').createIndex({ customer: 1, createdAt: -1 });

      // Audit logs indexes
      await db.collection('audit_logs').createIndex({ timestamp: -1 });
      await db.collection('audit_logs').createIndex({ userId: 1, timestamp: -1 });

      console.log('Created database indexes');
    },
  },
  {
    version: 2,
    name: 'add_retention_fields',
    async up(db) {
      // Add retention policy fields to existing invoices
      await db.collection('invoices').updateMany(
        { retentionPolicy: { $exists: false } },
        {
          $set: {
            retentionPolicy: '7_years',
            canBeDeleted: false,
          },
        }
      );

      // Add GDPR consent fields to existing users
      await db.collection('users').updateMany(
        { consentGiven: { $exists: false } },
        {
          $set: {
            consentGiven: false,
            isDeleted: false,
          },
        }
      );

      console.log('Added retention and GDPR fields');
    },
  },
  {
    version: 3,
    name: 'add_soft_delete_fields',
    async up(db) {
      // Ensure soft delete fields exist
      await db.collection('users').updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } }
      );

      await db.collection('orders').updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } }
      );

      console.log('Added soft delete fields');
    },
  },
];

async function migrate() {
  try {
    await mongoose.connect(DATABASE_URL);
    const db = mongoose.connection.db;
    console.log('Connected to database');

    // Create migrations tracking collection
    const migrationCollection = db.collection('_migrations');
    const completedMigrations = await migrationCollection.find({}).toArray();
    const completedVersions = new Set(completedMigrations.map(m => m.version));

    for (const migration of migrations) {
      if (completedVersions.has(migration.version)) {
        console.log(`Skipping migration ${migration.version}: ${migration.name} (already applied)`);
        continue;
      }

      console.log(`Running migration ${migration.version}: ${migration.name}...`);
      await migration.up(db);

      await migrationCollection.insertOne({
        version: migration.version,
        name: migration.name,
        appliedAt: new Date(),
      });

      console.log(`Migration ${migration.version} completed`);
    }

    console.log('\nAll migrations completed!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
