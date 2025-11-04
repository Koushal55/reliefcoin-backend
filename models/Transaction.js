const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  blockchainTxHash: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['MINT', 'REDEEM'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    default: null
  },
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt

module.exports = mongoose.model('Transaction', TransactionSchema);

