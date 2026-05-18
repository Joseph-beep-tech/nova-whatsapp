import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/azizi-portal';
    await mongoose.connect(uri);
    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    console.warn('⚠ Server will continue without database. Please ensure MongoDB is running.');
    // Don't exit - allow server to start anyway for development
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
};
