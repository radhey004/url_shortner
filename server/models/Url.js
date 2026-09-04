const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
  longUrl: {
    type: String,
    required: true,
  },

  shortCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  clicks: {
    type: Number,
    default: 0,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  visitorId: {
    type: String,
    default: null,
    index: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Url', urlSchema);