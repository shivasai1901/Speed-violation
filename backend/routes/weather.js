const express = require('express');
const axios = require('axios');
const router = express.Router();

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

// Weather at a single point
router.get('/weather', async (req, res) => {
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
        // Return mock data if API fails
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
});

// Weather along a route (sample multiple waypoints)
router.get('/weather/route', async (req, res) => {
    try {
        const { points } = req.query;
        if (!points) return res.status(400).json({ error: 'points required (lat,lon|lat,lon|...)' });

        const waypoints = points.split('|').map(p => {
            const [lat, lon] = p.split(',').map(Number);
            return { lat, lon };
        });

        // Sample up to 5 evenly-spaced points
        const sampleCount = Math.min(5, waypoints.length);
        const step = Math.max(1, Math.floor(waypoints.length / sampleCount));
        const sampled = [];
        for (let i = 0; i < waypoints.length && sampled.length < sampleCount; i += step) {
            sampled.push(waypoints[i]);
        }

        const weatherPromises = sampled.map(async (wp) => {
            try {
                const response = await axios.get(`${OWM_BASE}/weather`, {
                    params: {
                        lat: wp.lat,
                        lon: wp.lon,
                        appid: process.env.OWM_API_KEY,
                        units: 'metric'
                    }
                });
                const d = response.data;
                return {
                    lat: wp.lat,
                    lon: wp.lon,
                    location: d.name,
                    temperature: d.main.temp,
                    feels_like: d.main.feels_like,
                    humidity: d.main.humidity,
                    condition: d.weather[0].main,
                    description: d.weather[0].description,
                    icon: d.weather[0].icon,
                    wind_speed: d.wind.speed,
                    visibility: d.visibility
                };
            } catch {
                return {
                    lat: wp.lat,
                    lon: wp.lon,
                    location: 'Unknown',
                    temperature: 28,
                    condition: 'Clear',
                    description: 'clear sky',
                    icon: '01d',
                    wind_speed: 3,
                    visibility: 10000
                };
            }
        });

        const results = await Promise.all(weatherPromises);
        res.json(results);
    } catch (error) {
        console.error('Route weather error:', error.message);
        res.status(500).json({ error: 'Weather fetch failed' });
    }
});

module.exports = router;
