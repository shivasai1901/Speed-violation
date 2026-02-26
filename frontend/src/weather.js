/**
 * weather.js — Fetch and render weather data along the route
 */

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

    const pointsStr = sampled.map(p => `${p.lat},${p.lng}`).join('|');

    try {
        const response = await fetch(`/api/weather/route?points=${encodeURIComponent(pointsStr)}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn('Weather fetch failed:', e);
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
      <div class="weather-card-temp">${Math.round(w.temperature || 0)}°</div>
    `;

        container.appendChild(card);
    });
}
