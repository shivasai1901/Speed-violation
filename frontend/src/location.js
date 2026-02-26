/**
 * location.js — Live GPS tracking and speed calculation
 */

let watchId = null;
let lastPosition = null;
let lastTimestamp = null;
let onSpeedUpdate = null;
let onPositionUpdate = null;

/**
 * Start watching live GPS position
 * @param {Function} speedCb - called with speed in km/h
 * @param {Function} positionCb - called with {lat, lng}
 */
export function startTracking(speedCb, positionCb) {
    onSpeedUpdate = speedCb;
    onPositionUpdate = positionCb;

    if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        return false;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, speed: gpsSpeed } = position.coords;
            const now = position.timestamp;

            // If GPS provides speed directly (m/s → km/h)
            if (gpsSpeed !== null && gpsSpeed >= 0) {
                const speedKmh = gpsSpeed * 3.6;
                if (onSpeedUpdate) onSpeedUpdate(speedKmh);
            } else if (lastPosition && lastTimestamp) {
                // Calculate speed from positions
                const dist = haversine(lastPosition.lat, lastPosition.lng, latitude, longitude);
                const timeDiff = (now - lastTimestamp) / 1000; // seconds
                if (timeDiff > 0) {
                    const speedKmh = (dist / 1000) / (timeDiff / 3600);
                    if (onSpeedUpdate) onSpeedUpdate(speedKmh);
                }
            }

            lastPosition = { lat: latitude, lng: longitude };
            lastTimestamp = now;
            if (onPositionUpdate) onPositionUpdate({ lat: latitude, lng: longitude });
        },
        (error) => {
            console.warn('GPS error:', error.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
        }
    );

    return true;
}

/** Stop tracking */
export function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    lastPosition = null;
    lastTimestamp = null;
}

/** Get current GPS position as a promise */
export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

/** Haversine distance in meters */
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
    return deg * Math.PI / 180;
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLon = toRad(lng2 - lng1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}
