/**
 * main.js — Entry point: wires up all modules
 */
import './style.css';
import { initMap, setSourceMarker, setDestMarker, drawRoute, updateCarMarker, removeCarMarker, panTo } from './map.js';
import { getCurrentPosition } from './location.js';
import { initSpeedMonitor, updateSpeed, findCurrentSegment } from './speed.js';
import { fetchRouteWeather, renderWeatherCards } from './weather.js';
import {
    setupAutocomplete,
    showViolationAlert,
    hideViolationAlert,
    setupViolationClose,
    simulateDrive,
    showSection,
    hideSection,
    updateFindRouteBtn,
    displayRouteInfo
} from './ui.js';

// ─── Known cities fallback (lat, lng) ───
const KNOWN_CITIES = {
    'delhi': { lat: 28.6139, lng: 77.2090 },
    'new delhi': { lat: 28.6139, lng: 77.2090 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'bengaluru': { lat: 12.9716, lng: 77.5946 },
    'chennai': { lat: 13.0827, lng: 80.2707 },
    'kolkata': { lat: 22.5726, lng: 88.3639 },
    'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'pune': { lat: 18.5204, lng: 73.8567 },
    'jaipur': { lat: 26.9124, lng: 75.7873 },
    'ahmedabad': { lat: 23.0225, lng: 72.5714 },
    'lucknow': { lat: 26.8467, lng: 80.9462 },
    'warangal': { lat: 17.9784, lng: 79.5941 },
    'mysore': { lat: 12.2958, lng: 76.6394 },
    'mysuru': { lat: 12.2958, lng: 76.6394 },
    'nagpur': { lat: 21.1458, lng: 79.0882 },
    'indore': { lat: 22.7196, lng: 75.8577 },
    'bhopal': { lat: 23.2599, lng: 77.4126 },
    'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
    'vizag': { lat: 17.6868, lng: 83.2185 },
    'patna': { lat: 25.6093, lng: 85.1376 },
    'kanpur': { lat: 26.4499, lng: 80.3319 },
    'surat': { lat: 21.1702, lng: 72.8311 },
    'coimbatore': { lat: 11.0168, lng: 76.9558 },
    'kochi': { lat: 9.9312, lng: 76.2673 },
    'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
    'goa': { lat: 15.2993, lng: 74.1240 },
    'chandigarh': { lat: 30.7333, lng: 76.7794 },
    'dehradun': { lat: 30.3165, lng: 78.0322 },
    'agra': { lat: 27.1767, lng: 78.0081 },
    'varanasi': { lat: 25.3176, lng: 82.9739 },
    'amritsar': { lat: 31.6340, lng: 74.8723 },
    'ranchi': { lat: 23.3441, lng: 85.3096 },
    'guwahati': { lat: 26.1445, lng: 91.7362 },
    'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
    'vijayawada': { lat: 16.5062, lng: 80.6480 },
    'madurai': { lat: 9.9252, lng: 78.1198 },
    'tiruchirappalli': { lat: 10.7905, lng: 78.7047 },
    'trichy': { lat: 10.7905, lng: 78.7047 },
    'rajkot': { lat: 22.3039, lng: 70.8022 },
    'vadodara': { lat: 22.3072, lng: 73.1812 },
    'meerut': { lat: 28.9845, lng: 77.7064 },
    'nashik': { lat: 19.9975, lng: 73.7898 },
    'aurangabad': { lat: 19.8762, lng: 75.3433 },
    'jabalpur': { lat: 23.1815, lng: 79.9864 },
    'raipur': { lat: 21.2514, lng: 81.6296 },
    'jodhpur': { lat: 26.2389, lng: 73.0243 },
    'udaipur': { lat: 24.5854, lng: 73.7125 },
    'shimla': { lat: 31.1048, lng: 77.1734 },
    'manali': { lat: 32.2396, lng: 77.1887 },
    'rishikesh': { lat: 30.0869, lng: 78.2676 },
    'haridwar': { lat: 29.9457, lng: 78.1642 },
    'nanded': { lat: 19.1383, lng: 77.3210 },
    'karimnagar': { lat: 18.4386, lng: 79.1288 },
    'khammam': { lat: 17.2473, lng: 80.1514 },
    'nizamabad': { lat: 18.6725, lng: 78.0940 },
    'secunderabad': { lat: 17.4399, lng: 78.4983 },
};

// ─── App State ───
let sourceLocation = null;
let destLocation = null;
let routeData = null;
let simulation = null;

/**
 * Try to resolve a text input into a location {name, lat, lng}.
 * Tries: 1) API geocode 2) Known city lookup 3) Returns null
 */
async function resolveLocation(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // 1. Try API geocode
    try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
            const results = await res.json();
            if (results.length > 0) {
                return { name: results[0].name, lat: results[0].lat, lng: results[0].lng };
            }
        }
    } catch { /* API unavailable */ }

    // 2. Check known cities
    const key = trimmed.toLowerCase();
    if (KNOWN_CITIES[key]) {
        return { name: trimmed, lat: KNOWN_CITIES[key].lat, lng: KNOWN_CITIES[key].lng };
    }

    // 3. Partial match in known cities
    for (const [cityName, coords] of Object.entries(KNOWN_CITIES)) {
        if (cityName.includes(key) || key.includes(cityName)) {
            return { name: trimmed, lat: coords.lat, lng: coords.lng };
        }
    }

    return null;
}

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
    // Init map
    initMap();

    // Setup autocomplete for source
    setupAutocomplete('source-input', 'source-suggestions', (place) => {
        sourceLocation = place;
        setSourceMarker(place.lat, place.lng, place.name);
        panTo(place.lat, place.lng, 12);
        checkBothInputs();
    });

    // Setup autocomplete for destination
    setupAutocomplete('dest-input', 'dest-suggestions', (place) => {
        destLocation = place;
        setDestMarker(place.lat, place.lng, place.name);
        panTo(place.lat, place.lng, 12);
        checkBothInputs();
    });

    // Enable Find Route button whenever both inputs have text
    const sourceInput = document.getElementById('source-input');
    const destInput = document.getElementById('dest-input');

    sourceInput.addEventListener('input', checkBothInputs);
    destInput.addEventListener('input', checkBothInputs);

    // Enter key on either input triggers route finding
    sourceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (destInput.value.trim()) {
                findRoute();
            } else {
                destInput.focus();
            }
        }
    });

    destInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            findRoute();
        }
    });

    // Live location button
    document.getElementById('source-location-btn').addEventListener('click', async () => {
        const btn = document.getElementById('source-location-btn');
        btn.classList.add('loading');
        try {
            const pos = await getCurrentPosition();
            let name = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
            try {
                const res = await fetch(`/api/reverse-geocode?lat=${pos.lat}&lng=${pos.lng}`);
                if (res.ok) {
                    const data = await res.json();
                    name = data.name || name;
                }
            } catch { /* use coordinate name */ }

            sourceLocation = { lat: pos.lat, lng: pos.lng, name };
            sourceInput.value = name;
            setSourceMarker(pos.lat, pos.lng, name);
            panTo(pos.lat, pos.lng, 14);
            checkBothInputs();
        } catch (e) {
            console.error('Location error:', e);
            alert('Could not get your location. Please allow location access or enter manually.');
        }
        btn.classList.remove('loading');
    });

    // Setup violation close button
    setupViolationClose();

    // Setup speed monitor
    initSpeedMonitor(
        (speed, limit, mlData) => {
            const message = mlData?.message ||
                `Speed violation! ${Math.round(speed)} km/h in a ${Math.round(limit)} km/h zone!`;
            const severity = mlData?.severity || (speed - limit > 30 ? 'critical' : speed - limit > 15 ? 'high' : 'warning');
            showViolationAlert(message, severity);
        },
        () => {
            hideViolationAlert();
        }
    );

    // Find Route button
    document.getElementById('find-route-btn').addEventListener('click', findRoute);

    // Simulate Drive button
    document.getElementById('simulate-btn').addEventListener('click', startSimulation);

    // Stop Simulation button
    document.getElementById('stop-sim-btn').addEventListener('click', stopSimulation);

    // Demo route buttons
    document.querySelectorAll('.btn-demo').forEach(btn => {
        btn.addEventListener('click', () => {
            const srcName = btn.dataset.source;
            const srcLat = parseFloat(btn.dataset.sourceLat);
            const srcLng = parseFloat(btn.dataset.sourceLng);
            const dstName = btn.dataset.dest;
            const dstLat = parseFloat(btn.dataset.destLat);
            const dstLng = parseFloat(btn.dataset.destLng);

            sourceLocation = { lat: srcLat, lng: srcLng, name: srcName };
            sourceInput.value = srcName;
            setSourceMarker(srcLat, srcLng, srcName);

            destLocation = { lat: dstLat, lng: dstLng, name: dstName };
            destInput.value = dstName;
            setDestMarker(dstLat, dstLng, dstName);

            checkBothInputs();
            findRoute();
        });
    });
});

/**
 * Check if both inputs have text and enable/disable Find Route button
 */
function checkBothInputs() {
    const srcText = document.getElementById('source-input').value.trim();
    const dstText = document.getElementById('dest-input').value.trim();
    const btn = document.getElementById('find-route-btn');
    btn.disabled = !(srcText.length > 0 && dstText.length > 0);
}

// ─── Find Route ───
async function findRoute() {
    const srcText = document.getElementById('source-input').value.trim();
    const dstText = document.getElementById('dest-input').value.trim();

    if (!srcText || !dstText) return;

    const btn = document.getElementById('find-route-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        // Resolve source location if not already set or text changed
        if (!sourceLocation || sourceLocation.name !== srcText) {
            const resolved = await resolveLocation(srcText);
            if (resolved) {
                sourceLocation = resolved;
                setSourceMarker(resolved.lat, resolved.lng, resolved.name);
            } else {
                alert(`Could not find location: "${srcText}". Try a major city name like Delhi, Mumbai, Warangal, etc.`);
                btn.classList.remove('loading');
                btn.disabled = false;
                return;
            }
        }

        // Resolve destination location if not already set or text changed
        if (!destLocation || destLocation.name !== dstText) {
            const resolved = await resolveLocation(dstText);
            if (resolved) {
                destLocation = resolved;
                setDestMarker(resolved.lat, resolved.lng, resolved.name);
            } else {
                alert(`Could not find location: "${dstText}". Try a major city name like Delhi, Mumbai, Warangal, etc.`);
                btn.classList.remove('loading');
                btn.disabled = false;
                return;
            }
        }

        const start = `${sourceLocation.lng},${sourceLocation.lat}`;
        const end = `${destLocation.lng},${destLocation.lat}`;

        let data = null;

        // Try API route first
        try {
            const res = await fetch(`/api/route?start=${start}&end=${end}`);
            if (res.ok) {
                data = await res.json();
            }
        } catch { /* API failed */ }

        // Fallback: generate a synthetic route if API fails
        if (!data || !data.coordinates || data.coordinates.length === 0) {
            console.warn('API route failed, using fallback route generation');
            data = generateFallbackRoute(sourceLocation, destLocation);
        }

        routeData = data;

        // Draw route on map
        drawRoute(routeData.coordinates, routeData.segments);

        // Display route info
        displayRouteInfo(routeData.distance, routeData.duration);

        // Show speed section and simulate button
        showSection('speed-section');

        // Fetch and display weather (ignore errors)
        fetchRouteWeather(routeData.coordinates)
            .then(renderWeatherCards)
            .catch(() => console.warn('Weather fetch skipped'));

    } catch (e) {
        console.error('Route error:', e);
        alert('Failed to find route. Please try again.');
    }

    btn.classList.remove('loading');
    btn.disabled = false;
}

/**
 * Generate a fallback route between two points using interpolation.
 * Works offline without any API calls.
 */
function generateFallbackRoute(source, dest) {
    const numPoints = 80;
    const coordinates = [];

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const curveFactor = Math.sin(t * Math.PI) * 0.15;
        const lat = source.lat + (dest.lat - source.lat) * t + curveFactor * (dest.lng - source.lng) * 0.1;
        const lng = source.lng + (dest.lng - source.lng) * t - curveFactor * (dest.lat - source.lat) * 0.1;
        coordinates.push({ lat, lng });
    }

    // Haversine distance
    const R = 6371000;
    const dLat = (dest.lat - source.lat) * Math.PI / 180;
    const dLng = (dest.lng - source.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(source.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const duration = (distance / 1000) / 60 * 3600;

    const segmentTypes = [
        { name: 'City Roads', speedLimit: 40, fraction: 0.15 },
        { name: 'State Highway', speedLimit: 80, fraction: 0.20 },
        { name: 'National Highway', speedLimit: 100, fraction: 0.30 },
        { name: 'State Highway', speedLimit: 80, fraction: 0.20 },
        { name: 'City Roads', speedLimit: 40, fraction: 0.15 }
    ];

    const segments = [];
    let startIdx = 0;
    for (const type of segmentTypes) {
        const pointCount = Math.max(2, Math.round(numPoints * type.fraction));
        const endIdx = Math.min(startIdx + pointCount, coordinates.length);
        const wayPoints = coordinates.slice(startIdx, endIdx);
        if (wayPoints.length >= 2) {
            segments.push({
                instruction: `Continue on ${type.name}`,
                distance: distance * type.fraction,
                duration: duration * type.fraction,
                name: type.name,
                speedLimit: type.speedLimit,
                wayPoints
            });
        }
        startIdx = endIdx;
    }

    return {
        coordinates, distance, duration, segments, bbox: [
            Math.min(source.lng, dest.lng), Math.min(source.lat, dest.lat),
            Math.max(source.lng, dest.lng), Math.max(source.lat, dest.lat)
        ]
    };
}

// ─── Simulation ───
function startSimulation() {
    if (!routeData) return;

    document.getElementById('simulate-btn').classList.add('hidden');
    document.getElementById('stop-sim-btn').classList.remove('hidden');

    const floatingSpeed = document.getElementById('floating-speed');
    floatingSpeed.classList.remove('hidden');

    simulation = simulateDrive(
        routeData.coordinates,
        routeData.segments,
        (speed, pos, segment, bearing) => {
            const limit = segment ? segment.speedLimit : 60;
            if (segment) {
                const roadTypes = { 120: 0, 100: 1, 80: 2, 60: 3, 40: 4, 30: 4 };
                window.__currentRoadType = roadTypes[segment.speedLimit] ?? 3;
            }
            updateSpeed(speed, limit);
            updateCarMarker(pos.lat, pos.lng, bearing);
        },
        () => { stopSimulation(); }
    );
}

function stopSimulation() {
    if (simulation) {
        simulation.stop();
        simulation = null;
    }
    document.getElementById('simulate-btn').classList.remove('hidden');
    document.getElementById('stop-sim-btn').classList.add('hidden');
    removeCarMarker();
    hideViolationAlert();
    updateSpeed(0, 60);
}
