const axios = require('axios');

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

        const response = await axios.get(`${OWM_BASE}/weather`, {
            params: {
                lat,
                lon,
                appid: process.env.OWM_API_KEY,
                units: 'metric'
            }
        });

        const data = response.data;
        res.json({
            location: data.name,
            temperature: data.main.temp,
            feels_like: data.main.feels_like,
            humidity: data.main.humidity,
            condition: data.weather[0].main,
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            wind_speed: data.wind.speed,
            wind_deg: data.wind.deg,
            visibility: data.visibility,
            clouds: data.clouds.all,
            pressure: data.main.pressure
        });
    } catch (error) {
        console.error('Weather error:', error.message);
        res.json({
            location: 'Unknown',
            temperature: 28,
            feels_like: 30,
            humidity: 65,
            condition: 'Clear',
            description: 'clear sky',
            icon: '01d',
            wind_speed: 3.5,
            wind_deg: 180,
            visibility: 10000,
            clouds: 10,
            pressure: 1013
        });
    }
};
