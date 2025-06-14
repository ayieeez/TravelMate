const axios = require('axios');

exports.getExchangeRate = async (req, res) => {
  const { base, target } = req.query;
  
  try {
    // First try: Frankfurter API
    const response = await axios.get(
      `https://api.frankfurter.app/latest?from=${base}`
    );
    
    if (response.data.rates[target]) {
      return res.json({ rate: response.data.rates[target] });
    }
    
    // Fallback: ExchangeRate-API
    const fallbackResponse = await axios.get(
      `https://open.er-api.com/v6/latest/${base}`
    );
    
    if (fallbackResponse.data.result === 'success' && fallbackResponse.data.rates[target]) {
      return res.json({ rate: fallbackResponse.data.rates[target] });
    }
    
    // Final fallback: Fixed rates
    const fixedRates = {
      'USD_EUR': 0.93,
      'EUR_USD': 1.07,
      'USD_GBP': 0.79,
      'GBP_USD': 1.27,
      'USD_JPY': 147.50,
      'JPY_USD': 0.0068,
      'USD_MYR': 4.68,
      'MYR_USD': 0.21
    };
    
    const pair = `${base}_${target}`;
    if (fixedRates[pair]) {
      return res.json({ rate: fixedRates[pair] });
    }
    
    throw new Error('Currency conversion failed');
  } catch (error) {
    console.error('Currency API Error:', error.message);
    res.status(500).json({ error: "Currency conversion failed" });
  }
};