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

async function fetchFromOpenMeteo(lat, lon) {
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
        location: `${parseFloat(lat).toFixed(2)}°, ${parseFloat(lon).toFixed(2)}°`,
        temperature: current.temperature,
        feels_like: current.temperature,
        humidity: humidity,
        condition: weatherInfo.condition,
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        wind_speed: current.windspeed / 3.6, // km/h to m/s
        wind_deg: current.winddirection,
        visibility: visibility,
        clouds: 0,
        pressure: 1013
    };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

        // Try OpenWeatherMap first (if API key is set)
        if (process.env.OWM_API_KEY) {
            try {
                const response = await axios.get(`${OWM_BASE}/weather`, {
                    params: { lat, lon, appid: process.env.OWM_API_KEY, units: 'metric' }
                });
                const data = response.data;
                return res.json({
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
            } catch (owmError) {
                console.warn('OWM failed, trying Open-Meteo fallback:', owmError.message);
            }
        }

        // Fallback: Open-Meteo (free, no API key needed)
        const meteoData = await fetchFromOpenMeteo(lat, lon);
        res.json(meteoData);

    } catch (error) {
        console.error('Weather error (all sources failed):', error.message);
        res.status(500).json({ error: 'Weather data unavailable' });
    }
};
