import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not set in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // Atlas-recommended options
      serverSelectionTimeoutMS: 10000,  // 10s timeout finding primary
      socketTimeoutMS: 45000,           // 45s socket timeout
      maxPoolSize: 20,                  // max 20 connections in pool
      retryWrites: true,
    });

    const db = mongoose.connection.db;
    const dbName = db?.databaseName || 'unknown';
    console.log(`✅ MongoDB Atlas connected → ${dbName}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠  MongoDB disconnected — retrying...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error: any) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    console.error('   URI (masked):', uri.replace(/:([^:@]+)@/, ':****@'));
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('MongoDB disconnected cleanly.');
};
