const axios = require('axios');
const CurrencyRate = require('../models/CurrencyRate');

exports.getExchangeRate = async (req, res) => {
  const { base, target } = req.query;

  try {
    const response = await axios.get(`https://api.frankfurter.app/latest?from=${base}`);
    const rate = response.data.rates[target];

    if (rate) {
      await CurrencyRate.create({ base, target, rate });
      return res.json({ rate });
    }

    const fallback = await axios.get(`https://open.er-api.com/v6/latest/${base}`);
    if (fallback.data.result === 'success' && fallback.data.rates[target]) {
      await CurrencyRate.create({ base, target, rate: fallback.data.rates[target] });
      return res.json({ rate: fallback.data.rates[target] });
    }

    const fixedRates = {
      'USD_EUR': 0.93, 'EUR_USD': 1.07,
      'USD_GBP': 0.79, 'GBP_USD': 1.27,
      'USD_JPY': 147.50, 'JPY_USD': 0.0068,
      'USD_MYR': 4.68, 'MYR_USD': 0.21
    };

    const pair = `${base}_${target}`;
    if (fixedRates[pair]) {
      await CurrencyRate.create({ base, target, rate: fixedRates[pair] });
      return res.json({ rate: fixedRates[pair] });
    }

    throw new Error('Currency conversion failed');
  } catch (error) {
    console.error('Currency API Error:', error.message);
    res.status(500).json({ error: "Currency conversion failed" });
  }
};
