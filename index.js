require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const ethers = require('ethers');
const contractABI = require('./contracts/ReliefCoin.json').abi;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect to Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection failed:', err.message));

// Connect to Blockchain
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const reliefCoinContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, signer);
console.log('Connected to Blockchain and loaded ReliefCoin contract.');

// API Routes
app.use('/api/auth', require('./routes/auth')(reliefCoinContract, provider));
app.use('/api/ngo', require('./routes/ngo')(reliefCoinContract)); // <-- New NGO routes
app.use('/api/public', require('./routes/public')(provider, process.env.CONTRACT_ADDRESS));
app.use('/api/auth', require('./routes/auth')(reliefCoinContract, provider));
app.use('/api/ngo', require('./routes/ngo')(reliefCoinContract, provider)); 
app.use('/api/donor', require('./routes/donor'));

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
