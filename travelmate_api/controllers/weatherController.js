const axios = require('axios');

exports.getWeather = async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`
    );
    
    res.json({
      temp: response.data.main.temp,
      description: response.data.weather[0].description,
      icon: response.data.weather[0].icon,
      humidity: response.data.main.humidity,
      city: response.data.name,
      country: response.data.sys?.country
    });
  } catch (error) {
    console.error('Weather API Error:', error.response?.data || error.message);
    res.status(500).json({ error: "Weather data fetch failed" });
  }
};