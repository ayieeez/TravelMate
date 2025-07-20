const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (err) {
    console.warn('MongoDB connection failed, continuing without database:', err.message);
    // Don't exit the process, continue without MongoDB
  }
};

module.exports = connectDB;