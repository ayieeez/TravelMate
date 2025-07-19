const mongoose = require('mongoose');

const CurrencyRateSchema = new mongoose.Schema({
  base: String,
  target: String,
  rate: Number,
  fetchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CurrencyRate', CurrencyRateSchema);
