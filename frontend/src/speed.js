/**
 * speed.js — Speed violation detection, gauge updates, ML prediction calls
 */

let currentSpeed = 0;
let currentLimit = 60;
let isViolating = false;
let onViolation = null;
let onSafe = null;

/**
 * Initialize speed monitor
 * @param {Function} violationCb - called when speed exceeds limit
 * @param {Function} safeCb - called when speed returns to safe
 */
export function initSpeedMonitor(violationCb, safeCb) {
    onViolation = violationCb;
    onSafe = safeCb;
}

/**
 * Update current speed and check against limit
 * @param {number} speed - current speed in km/h
 * @param {number} limit - speed limit for current road segment
 */
export function updateSpeed(speed, limit) {
    currentSpeed = Math.max(0, speed);
    if (limit > 0) currentLimit = limit;

    // Update gauge visuals
    updateGauge(currentSpeed, currentLimit);

    // Update floating speed
    updateFloatingSpeed(currentSpeed);

    // Check violation
    const wasViolating = isViolating;
    isViolating = currentSpeed > currentLimit;

    if (isViolating && !wasViolating) {
        // Just started violating
        if (onViolation) {
            onViolation(currentSpeed, currentLimit);
        }
        // Also call ML prediction
        predictViolation(currentSpeed, currentLimit);
    } else if (!isViolating && wasViolating) {
        // Returned to safe speed
        if (onSafe) onSafe();
    }
}

/** Update the SVG gauge arc */
function updateGauge(speed, limit) {
    const gaugeFill = document.getElementById('gauge-fill');
    const speedValue = document.getElementById('current-speed-value');
    const limitValue = document.getElementById('speed-limit-value');
    const gauge = document.getElementById('speed-gauge');

    if (!gaugeFill || !speedValue) return;

    const maxSpeed = Math.max(limit * 1.8, 180);
    const ratio = Math.min(speed / maxSpeed, 1);
    const totalLength = 251.2; // arc length
    const offset = totalLength * (1 - ratio);

    gaugeFill.style.strokeDashoffset = offset;
    speedValue.textContent = Math.round(speed);
    if (limitValue) limitValue.textContent = Math.round(limit);

    if (gauge) {
        if (speed > limit) {
            gauge.classList.add('violation');
        } else {
            gauge.classList.remove('violation');
        }
    }
}

/** Update floating speed badge */
function updateFloatingSpeed(speed) {
    const floatingEl = document.getElementById('floating-speed');
    const floatingValue = document.getElementById('floating-speed-value');
    if (!floatingEl || !floatingValue) return;

    floatingValue.textContent = Math.round(speed);

    if (isViolating) {
        floatingEl.classList.add('violation');
    } else {
        floatingEl.classList.remove('violation');
    }
}

/** Call ML prediction service */
async function predictViolation(speed, limit) {
    try {
        const weatherCondition = window.__currentWeather || 'clear';
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                speed,
                limit,
                weather: weatherCondition,
                visibility: window.__currentVisibility || 10,
                road_type: window.__currentRoadType || 3,
                hour: new Date().getHours()
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.violation && onViolation) {
                onViolation(speed, limit, data);
            }
        }
    } catch (e) {
        // Silently fail — violation is already detected by rule
        console.warn('ML prediction unavailable:', e.message);
    }
}

/**
 * Find which route segment a position is on
 * @param {{ lat: number, lng: number }} pos
 * @param {Array} segments - route segments from API
 * @returns {Object|null} the segment the position is nearest to
 */
export function findCurrentSegment(pos, segments) {
    if (!segments || segments.length === 0) return null;

    let nearest = null;
    let minDist = Infinity;

    for (const seg of segments) {
        if (!seg.wayPoints) continue;
        for (const wp of seg.wayPoints) {
            const d = Math.sqrt((pos.lat - wp.lat) ** 2 + (pos.lng - wp.lng) ** 2);
            if (d < minDist) {
                minDist = d;
                nearest = seg;
            }
        }
    }

    return nearest;
}

export function getCurrentSpeed() { return currentSpeed; }
export function getCurrentLimit() { return currentLimit; }
export function getIsViolating() { return isViolating; }
