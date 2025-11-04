const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const User = require('../models/User');
const Transaction = require('../models/Transaction'); // --- V2.0: Import Transaction model
const contractABI = require('../contracts/ReliefCoin.json').abi;

module.exports = function(provider, contractAddress) {
  
  // GET /api/public/user/:id (Unchanged)
  router.get('/user/:id', async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select('name');
      if (!user) return res.status(404).json({ msg: 'User not found' });
      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // GET /api/public/transactions (Blockchain-only feed - Unchanged)
  router.get('/transactions', async (req, res) => {
    try {
      const reliefCoinContract = new ethers.Contract(contractAddress, contractABI, provider);
      const transferEvents = await reliefCoinContract.queryFilter('Transfer', 0, 'latest');
      const formattedTransactions = transferEvents.map(event => ({
        txHash: event.transactionHash,
        from: event.args.from,
        to: event.args.to,
        amount: ethers.formatUnits(event.args.value, 18),
        blockNumber: event.blockNumber,
      })).reverse();
      res.json(formattedTransactions);
    } catch (err) {
      console.error("Failed to fetch blockchain transactions:", err.message);
      res.status(500).send('Server Error');
    }
  });

  // --- V2.0: NEW ROUTE TO GET CAMPAIGN-SPECIFIC TRANSACTIONS FROM OUR DATABASE ---
  // GET /api/public/campaign/:campaignId/transactions
  router.get('/campaign/:campaignId/transactions', async (req, res) => {
    try {
      const { campaignId } = req.params;

      const transactions = await Transaction.find({ campaign: campaignId })
        .populate('beneficiary', 'name') // Get the beneficiary's name from the User collection
        .populate('vendor', 'name')       // Get the vendor's name from the User collection
        .sort({ createdAt: -1 });       // Show newest first

      res.json(transactions);

    } catch (err) {
      console.error("Failed to fetch campaign transactions:", err.message);
      res.status(500).send('Server Error');
    }
  });
  // --- END OF NEW ROUTE ---

  return router;
};
