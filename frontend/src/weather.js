/**
 * weather.js — Fetch and render weather data along the route
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// Map WMO weather codes to conditions and OWM-compatible icons
const WMO_MAP = {
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
    80: { condition: 'Rain', description: 'rain showers', icon: '09d' },
    81: { condition: 'Rain', description: 'moderate rain showers', icon: '09d' },
    82: { condition: 'Rain', description: 'violent rain showers', icon: '09d' },
    95: { condition: 'Thunderstorm', description: 'thunderstorm', icon: '11d' },
    96: { condition: 'Thunderstorm', description: 'thunderstorm with hail', icon: '11d' },
    99: { condition: 'Thunderstorm', description: 'thunderstorm with heavy hail', icon: '11d' },
};

/**
 * Fetch weather for a single point directly from Open-Meteo (free, no API key)
 */
async function fetchOpenMeteoWeather(lat, lng) {
    const res = await fetch(
        `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relativehumidity_2m,visibility&forecast_days=1`
    );
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

    const data = await res.json();
    const current = data.current_weather;
    const hourly = data.hourly;
    const hr = new Date().getHours();
    const humidity = hourly?.relativehumidity_2m?.[hr] || 50;
    const visibility = hourly?.visibility?.[hr] || 10000;
    const info = WMO_MAP[current.weathercode] || WMO_MAP[0];

    return {
        lat, lng,
        location: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
        temperature: current.temperature,
        feels_like: current.temperature,
        humidity,
        condition: info.condition,
        description: info.description,
        icon: info.icon,
        wind_speed: (current.windspeed / 3.6).toFixed(1), // km/h → m/s
        visibility
    };
}

/**
 * Fetch weather for multiple waypoints along the route
 * @param {Array<{lat: number, lng: number}>} coordinates
 * @returns {Promise<Array>}
 */
export async function fetchRouteWeather(coordinates) {
    if (!coordinates || coordinates.length === 0) return [];

    // Sample up to 5 points
    const count = Math.min(5, coordinates.length);
    const step = Math.max(1, Math.floor(coordinates.length / count));
    const sampled = [];
    for (let i = 0; i < coordinates.length && sampled.length < count; i += step) {
        sampled.push(coordinates[i]);
    }

    // Try backend API first
    const pointsStr = sampled.map(p => `${p.lat},${p.lng}`).join('|');
    try {
        const response = await fetch(`/api/weather/route?points=${encodeURIComponent(pointsStr)}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) return data;
        }
    } catch (e) {
        console.warn('Backend weather API failed:', e.message);
    }

    // Fallback: Direct Open-Meteo calls (free, no API key needed)
    console.log('Using Open-Meteo direct fallback for weather...');
    try {
        const promises = sampled.map(p => fetchOpenMeteoWeather(p.lat, p.lng));
        const results = await Promise.all(promises);
        return results;
    } catch (e) {
        console.warn('Open-Meteo fallback also failed:', e.message);
    }

    return [];
}

/**
 * Render weather cards in the sidebar
 * @param {Array} weatherData
 */
export function renderWeatherCards(weatherData) {
    const container = document.getElementById('weather-cards');
    const section = document.getElementById('weather-section');
    if (!container || !section) return;

    if (!weatherData || weatherData.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';

    // Store first weather condition globally for ML model
    if (weatherData.length > 0) {
        window.__currentWeather = weatherData[0].condition?.toLowerCase() || 'clear';
        window.__currentVisibility = (weatherData[0].visibility || 10000) / 1000;
    }

    weatherData.forEach((w, idx) => {
        const card = document.createElement('div');
        card.className = 'weather-card';

        const iconUrl = w.icon
            ? `https://openweathermap.org/img/wn/${w.icon}@2x.png`
            : 'https://openweathermap.org/img/wn/01d@2x.png';

        const temp = Math.round(w.temperature || 0);

        card.innerHTML = `
      <div class="weather-card-icon">
        <img src="${iconUrl}" alt="${w.condition || 'weather'}" />
      </div>
      <div class="weather-card-info">
        <div class="weather-card-location">${w.location || `Point ${idx + 1}`}</div>
        <div class="weather-card-condition">${w.description || w.condition || 'Clear'}</div>
        <div class="weather-card-details">
          <span class="weather-detail">💨 ${w.wind_speed || 0} m/s</span>
          <span class="weather-detail">👁️ ${((w.visibility || 10000) / 1000).toFixed(1)} km</span>
          ${w.humidity ? `<span class="weather-detail">💧 ${w.humidity}%</span>` : ''}
        </div>
      </div>
      <div class="weather-card-temp">${temp}°C</div>
    `;

        container.appendChild(card);
    });
}
