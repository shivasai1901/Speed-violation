const axios = require('axios');

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

// Map WMO weather codes to conditions and OWM-compatible icons
function mapWmoCode(code) {
    const mapping = {
        0: { condition: 'Clear', description: 'clear sky', icon: '01d' },
        1: { condition: 'Clear', description: 'mainly clear', icon: '01d' },
        2: { condition: 'Clouds', description: 'partly cloudy', icon: '02d' },
        3: { condition: 'Clouds', description: 'overcast', icon: '04d' },
        45: { condition: 'Fog', description: 'fog', icon: '50d' },
        48: { condition: 'Fog', description: 'depositing rime fog', icon: '50d' },
        51: { condition: 'Drizzle', description: 'light drizzle', icon: '09d' },
        53: { condition: 'Drizzle', description: 'moderate drizzle', icon: '09d' },
        55: { condition: 'Drizzle', description: 'dense drizzle', icon: '09d' },
        61: { condition: 'Rain', description: 'slight rain', icon: '10d' },
        63: { condition: 'Rain', description: 'moderate rain', icon: '10d' },
        65: { condition: 'Rain', description: 'heavy rain', icon: '10d' },
        71: { condition: 'Snow', description: 'slight snow', icon: '13d' },
        73: { condition: 'Snow', description: 'moderate snow', icon: '13d' },
        75: { condition: 'Snow', description: 'heavy snow', icon: '13d' },
        80: { condition: 'Rain', description: 'slight rain showers', icon: '09d' },
        81: { condition: 'Rain', description: 'moderate rain showers', icon: '09d' },
        82: { condition: 'Rain', description: 'violent rain showers', icon: '09d' },
        95: { condition: 'Thunderstorm', description: 'thunderstorm', icon: '11d' },
        96: { condition: 'Thunderstorm', description: 'thunderstorm with hail', icon: '11d' },
        99: { condition: 'Thunderstorm', description: 'thunderstorm with heavy hail', icon: '11d' },
    };
    return mapping[code] || { condition: 'Clear', description: 'clear sky', icon: '01d' };
}

async function fetchSinglePointWeather(lat, lon) {
    // Try OWM first
    if (process.env.OWM_API_KEY) {
        try {
            const response = await axios.get(`${OWM_BASE}/weather`, {
                params: { lat, lon, appid: process.env.OWM_API_KEY, units: 'metric' }
            });
            const d = response.data;
            return {
                lat, lon,
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
            // Fall through to Open-Meteo
        }
    }

    // Fallback: Open-Meteo (free, no API key)
    const response = await axios.get(OPEN_METEO_BASE, {
        params: {
            latitude: lat,
            longitude: lon,
            current_weather: true,
            hourly: 'relativehumidity_2m,visibility',
            forecast_days: 1
        }
    });
    const current = response.data.current_weather;
    const hourly = response.data.hourly;
    const currentHour = new Date().getHours();
    const humidity = hourly?.relativehumidity_2m?.[currentHour] || 50;
    const visibility = hourly?.visibility?.[currentHour] || 10000;
    const weatherInfo = mapWmoCode(current.weathercode);

    return {
        lat, lon,
        location: `${parseFloat(lat).toFixed(2)}°, ${parseFloat(lon).toFixed(2)}°`,
        temperature: current.temperature,
        feels_like: current.temperature,
        humidity,
        condition: weatherInfo.condition,
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        wind_speed: current.windspeed / 3.6,
        visibility
    };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

        const weatherPromises = sampled.map(wp => fetchSinglePointWeather(wp.lat, wp.lon));
        const results = await Promise.all(weatherPromises);
        res.json(results);
    } catch (error) {
        console.error('Route weather error:', error.message);
        res.status(500).json({ error: 'Weather fetch failed' });
    }
};
