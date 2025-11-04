const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authmiddleware'); // Our new security guard
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');

router.post('/donate', authMiddleware, async (req, res) => {
  // We get the user ID from the authMiddleware (req.user.id)
  const { name, phone, amount, campaignId } = req.body;
  
  try {
    // 1. Find the campaign to update it
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ msg: 'Campaign not found' });
    }

    // 2. Check validation
    const remainingNeeded = campaign.targetAmount - campaign.raisedAmount;
    if (Number(amount) > remainingNeeded) {
      return res.status(400).json({ msg: `Donation of ₹${amount} exceeds the remaining goal of ₹${remainingNeeded}.` });
    }

    // 3. Create a new Donation record
    const newDonation = new Donation({
      user: req.user.id, // Get the user ID from the logged-in user
      campaign: campaignId,
      donorName: name,
      donorPhone: phone,
      amount: Number(amount),
    });
    
    await newDonation.save();

    // 4. Update the campaign's raisedAmount
    campaign.raisedAmount += Number(amount);
    await campaign.save();

    res.status(201).json(newDonation); // Send back the new donation

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/donor/my-donations
// @desc    Get all donations for the logged-in user
// @access  Private (Requires login)
router.get('/my-donations', authMiddleware, async (req, res) => {
  try {
    // Find all donations linked to the user's ID and sort by newest first
    // We use .populate() to also fetch the campaign's name
    const donations = await Donation.find({ user: req.user.id })
      .populate('campaign', 'name')
      .sort({ createdAt: -1 });
      
    res.json(donations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

