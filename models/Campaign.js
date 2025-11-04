const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  distributedAmount: { type: Number, default: 0 },
  raisedAmount: { type: Number, default: 0 },
});

module.exports = mongoose.model('Campaign', CampaignSchema);