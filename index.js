require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const ethers = require('ethers'); // <-- Import ethers
const contractABI = require('./contracts/ReliefCoin.json').abi; // <-- Import the ABI

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection failed:', err.message));
// -------------------------

// --- BLOCKCHAIN CONNECTION ---
const provider = new ethers.JsonRpcProvider('http://localhost:8545'); // Hardhat node URL
const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const reliefCoinContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, signer);
console.log('Connected to Blockchain and loaded ReliefCoin contract.');
// -------------------------

// --- API ROUTES ---
app.use('/api/auth', require('./routes/auth'));

// UPDATED: Issue Aid endpoint now mints tokens
app.post('/api/issue', async (req, res) => {
  const { beneficiary, amount } = req.body;
  
  // For now, we need a placeholder blockchain address for the beneficiary
  // We'll use another test account from our Hardhat node for this
  const beneficiaryAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Hardhat Account #1
  
  console.log(`Attempting to mint ${amount} RC for ${beneficiary} at address ${beneficiaryAddress}`);

  try {
    // Convert the amount to the correct format (with 18 decimals, standard for ERC20)
    const amountToMint = ethers.parseUnits(amount.toString(), 18);

    // Call the mint function on the smart contract
    const tx = await reliefCoinContract.mint(beneficiaryAddress, amountToMint);
    
    // Wait for the transaction to be mined
    await tx.wait();

    console.log('Minting successful! Transaction hash:', tx.hash);

    // In a real app, you would now save the beneficiary details to your MongoDB
    
    res.status(201).json({ 
      message: 'Tokens minted successfully!', 
      txHash: tx.hash 
    });

  } catch (error) {
    console.error("Error minting tokens:", error);
    res.status(500).send('Server Error: Failed to mint tokens');
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});