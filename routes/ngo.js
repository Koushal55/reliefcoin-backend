const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const User = require('../models/User');
const Beneficiary = require('../models/Beneficiary');
const Campaign = require('../models/Campaign');
const Transaction = require('../models/Transaction'); // --- V2.0: Import the new Transaction model
const twilio = require('twilio');
const QRCode = require('qrcode');
const axios = require('axios');
const FormData = require('form-data');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = function(reliefCoinContract) {

  // GET /api/ngo/campaigns (Unchanged)
  router.get('/campaigns', async (req, res) => {
    try {
      const campaigns = await Campaign.find();
      res.json(campaigns);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // POST /api/ngo/campaigns (Unchanged)
  router.post('/campaigns', async (req, res) => {
    const { name, description, targetAmount } = req.body;
    try {
      const newCampaign = new Campaign({ name, description, targetAmount, raisedAmount: 0, distributedAmount: 0 });
      await newCampaign.save();
      res.status(201).json(newCampaign);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // POST /api/ngo/beneficiaries (Unchanged)
  router.post('/beneficiaries', async (req, res) => {
    const { name, email, phone } = req.body;
    try {
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ msg: 'A user with this email already exists.' });
      const wallet = ethers.Wallet.createRandom();
      const newUser = new User({
        name, email, password: 'defaultPassword123', role: 'beneficiary',
        walletAddress: wallet.address, privateKey: wallet.privateKey,
      });
      await newUser.save();
      const newBeneficiary = new Beneficiary({ name, phone, userAccount: newUser._id });
      await newBeneficiary.save();
      
      const messageBody = `Welcome to ReliefCoin, ${name}! Your secure wallet address is: ${wallet.address}`;
      await twilioClient.messages.create({
         body: messageBody,
         from: process.env.TWILIO_PHONE_NUMBER,
         to: `+91${phone}` 
      });
      console.log(`Registration SMS sent successfully to ${phone}`);
      
      res.status(201).json({ user: newUser, beneficiary: newBeneficiary });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // GET /api/ngo/beneficiaries (Unchanged)
  router.get('/beneficiaries', async (req, res) => {
    try {
      const beneficiaries = await User.find({ role: 'beneficiary' }).select('name walletAddress');
      res.json(beneficiaries);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

  // --- V2.0: UPDATED "ISSUE AID" ROUTE ---
  router.post('/issue-aid', async (req, res) => {
    const { beneficiaryPhone, amount, campaignId } = req.body;
    try {
        const beneficiary = await Beneficiary.findOne({ phone: beneficiaryPhone });
        if (!beneficiary) {
            return res.status(404).json({ msg: 'Beneficiary with this phone number not found.' });
        }
        const user = await User.findById(beneficiary.userAccount);
        if (!user) {
            return res.status(404).json({ msg: 'User account for this beneficiary not found.' });
        }
        const beneficiaryWallet = user.walletAddress;

        // 1. Mint tokens on the blockchain
        const amountToMint = ethers.parseUnits(amount.toString(), 18);
        const tx = await reliefCoinContract.mint(beneficiaryWallet, amountToMint);
        await tx.wait();
        console.log(`Minting successful! Tx: ${tx.hash}`);

        // 2. Generate and upload QR code (using the user's MongoDB ID for scanning)
        const qrCodeDataUrl = await QRCode.toDataURL(user._id.toString());
        const base64Image = qrCodeDataUrl.split(';base64,').pop();
        const form = new FormData();
        form.append('key', process.env.IMGBB_API_KEY);
        form.append('image', base64Image);
        const imgbbResponse = await axios.post('https://api.imgbb.com/1/upload', form, { headers: form.getHeaders() });
        const qrCodeUrl = imgbbResponse.data.data.url;
        console.log(`QR Code uploaded to ImgBB: ${qrCodeUrl}`);

        // 3. Update campaign data
        await Campaign.findByIdAndUpdate(campaignId, { $inc: { distributedAmount: Number(amount) } });

        // 4. --- NEW: Create a record of this transaction in our database ---
        const newTransaction = new Transaction({
            blockchainTxHash: tx.hash,
            type: 'MINT',
            amount: Number(amount),
            campaign: campaignId,
            beneficiary: user._id,
            vendor: null // No vendor involved in a mint
        });
        await newTransaction.save();
        console.log("MINT transaction saved to database.");
        // --- END OF NEW LOGIC ---

        // 5. Send the ImgBB link in the SMS
        const messageBody = `Hello ${beneficiary.name}, you have received ${amount} ReliefCoin! To redeem, open this link: ${qrCodeUrl}`;
        await twilioClient.messages.create({
           body: messageBody,
           from: process.env.TWILIO_PHONE_NUMBER,
           to: `+91${beneficiary.phone}`
        });
        console.log(`Aid notification SMS with ImgBB link sent to ${beneficiary.phone}`);

        res.status(201).json({ msg: 'Aid issued, QR uploaded, and link sent successfully', txHash: tx.hash, qrUrl: qrCodeUrl });
    } catch (err) {
        // Check for specific ImgBB error
        if (err.response && err.response.data) {
            console.error("Error during issue-aid (from ImgBB or other):", err.response.data);
        } else {
            console.error("Error during issue-aid:", err.message);
        }
        res.status(500).send('Server Error');
    }
  });

  return router;
};