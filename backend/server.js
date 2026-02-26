const express = require('express');
const cors = require('cors');
require('dotenv').config();

const mapsRoutes = require('./routes/maps');
const weatherRoutes = require('./routes/weather');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', mapsRoutes);
app.use('/api', weatherRoutes);

// ML Prediction proxy
const axios = require('axios');
app.post('/api/predict', async (req, res) => {
  try {
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:5000';
    const response = await axios.post(`${mlUrl}/predict`, req.body);
    res.json(response.data);
  } catch (error) {
    // Fallback: simple rule-based prediction if ML service is down
    const { speed, limit, weather } = req.body;
    const isViolation = speed > limit;
    const weatherPenalty = ['rain', 'snow', 'fog', 'thunderstorm'].includes(weather?.toLowerCase()) ? 10 : 0;
    const adjustedLimit = limit - weatherPenalty;
    res.json({
      violation: speed > adjustedLimit,
      probability: Math.min(1, Math.max(0, (speed - adjustedLimit) / adjustedLimit)),
      recommended_speed: adjustedLimit,
      message: isViolation
        ? `⚠️ Speed violation! You are going ${speed} km/h in a ${limit} km/h zone.`
        : 'Speed is within limits.',
      weather_advisory: weatherPenalty > 0
        ? `Reduce speed by ${weatherPenalty} km/h due to ${weather} conditions.`
        : null
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[OK] Speed Violation Detector backend running on http://localhost:${PORT}`);
});
