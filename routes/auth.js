const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const User = require('../models/User');
const Transaction = require('../models/Transaction'); // --- V2.0: Import Transaction model
const Beneficiary = require('../models/Beneficiary'); // --- V2.0: Import Beneficiary model
const Campaign = require('../models/Campaign');

module.exports = function(reliefCoinContract, provider) {
  
  // POST api/auth/register (Unchanged)
  router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ msg: 'User already exists' });
      const wallet = ethers.Wallet.createRandom();
      user = new User({ name, email, password, role, walletAddress: wallet.address, privateKey: wallet.privateKey });
      await user.save();
      // Also create a Beneficiary profile if the role is 'beneficiary'
      if(role === 'beneficiary') {
        // We'll use a placeholder phone for now, as the main registration doesn't ask for it
        const newBeneficiary = new Beneficiary({ name, phone: '0000000000', userAccount: user._id });
        await newBeneficiary.save();
      }
      res.status(201).json({ msg: 'User registered successfully' });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // POST api/auth/login (Unchanged)
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      let user = await User.findOne({ email });
      if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });
      const payload = { user: { id: user.id, role: user.role } };
      jwt.sign(payload, process.env.MONGO_URI, { expiresIn: 3600 }, (err, token) => {
        if (err) throw err;
        res.json({ token });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // GET api/auth/balance/:address (Unchanged)
  router.get('/balance/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const balance = await reliefCoinContract.balanceOf(address);
      const formattedBalance = ethers.formatUnits(balance, 18);
      res.json({ address, balance: formattedBalance });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });
  
  // POST api/auth/fund-wallet (Unchanged)
  router.post('/fund-wallet', async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) return res.status(400).json({ msg: 'Address is required' });
      const ownerSigner = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
      const tx = await ownerSigner.sendTransaction({
        to: address,
        value: ethers.parseEther("1.0")
      });
      await tx.wait();
      res.json({ msg: 'Wallet funded successfully', txHash: tx.hash });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // --- V2.0: UPDATED "REDEEM" ROUTE ---
  router.post('/redeem', async (req, res) => {
    // beneficiaryId is the MongoDB User ID (from the QR)
    // vendorId is the MongoDB User ID (from the logged-in vendor)
    const { beneficiaryId, vendorId, amount } = req.body; 

    try {
      const beneficiaryUser = await User.findById(beneficiaryId).select('+privateKey');
      const vendorUser = await User.findById(vendorId);

      if (!beneficiaryUser || !vendorUser) {
        return res.status(404).json({ msg: 'User not found' });
      }

      // 1. Create a signer for the beneficiary
      const beneficiarySigner = new ethers.Wallet(beneficiaryUser.privateKey, provider);
      
      // 2. Connect this signer to the ReliefCoin contract
      const contractAsBeneficiary = reliefCoinContract.connect(beneficiarySigner);

      // 3. Convert the amount
      const amountToTransfer = ethers.parseUnits(amount.toString(), 18);

      // 4. Call the 'transfer' function on the contract
      console.log(`Transferring ${amount} RC from ${beneficiaryUser.name} to ${vendorUser.name}...`);
      const tx = await contractAsBeneficiary.transfer(vendorUser.walletAddress, amountToTransfer);
      await tx.wait(); // Wait for the transaction to be mined

      console.log(`Transfer successful! Transaction hash: ${tx.hash}`);

      // 5. --- NEW: Create a record of this transaction in our database ---
       const firstCampaign = await Campaign.findOne().sort({ createdAt: -1 });
      let campaignId = firstCampaign ? firstCampaign._id : null;

      const newTransaction = new Transaction({
          blockchainTxHash: tx.hash,
          type: 'REDEEM',
          amount: Number(amount),
          campaign: campaignId,
          beneficiary: beneficiaryUser._id,
          vendor: vendorUser._id
      });
      await newTransaction.save();
      console.log("REDEEM transaction saved to database.");
      // --- END OF NEW LOGIC ---

      res.json({ msg: 'Redemption successful', txHash: tx.hash });

    } catch (err) {
      console.error("Error in /redeem route:", err.message);
      res.status(500).send('Server Error');
    }
  });
  
  return router;
};
