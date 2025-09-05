// This must be at the very top
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    // Exit process with failure
    process.exit(1);
  }
};

connectDB();
// -------------------------

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the ReliefCoin API! Now with a database connection.' });
});

// We will re-build our API routes in the next step to use the database.
// The old mock-data routes are now removed.

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});