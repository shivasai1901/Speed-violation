/**
 * ui.js — Autocomplete, violation popup, simulation controls
 */

import { calculateBearing } from './location.js';

let debounceTimer = null;

/**
 * Setup autocomplete on an input element
 * @param {string} inputId
 * @param {string} suggestionsId
 * @param {Function} onSelect - called with {name, lat, lng}
 */
export function setupAutocomplete(inputId, suggestionsId, onSelect) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(suggestionsId);
    if (!input || !list) return;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();
        if (query.length < 3) {
            list.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
                if (!res.ok) return;
                const results = await res.json();

                list.innerHTML = '';
                if (results.length === 0) {
                    list.classList.add('hidden');
                    return;
                }

                results.forEach(r => {
                    const li = document.createElement('li');
                    li.textContent = r.name;
                    li.addEventListener('click', () => {
                        input.value = r.name;
                        list.classList.add('hidden');
                        if (onSelect) onSelect(r);
                    });
                    list.appendChild(li);
                });
                list.classList.remove('hidden');
            } catch (e) {
                console.warn('Autocomplete error:', e);
            }
        }, 350);
    });

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !list.contains(e.target)) {
            list.classList.add('hidden');
        }
    });
}

/**
 * Show violation alert popup
 * @param {string} message
 * @param {string} severity - 'warning', 'high', 'critical'
 */
export function showViolationAlert(message, severity = 'high') {
    const alert = document.getElementById('violation-alert');
    const msgEl = document.getElementById('violation-message');
    if (!alert || !msgEl) return;

    msgEl.textContent = message;

    // Remove old severity classes
    alert.classList.remove('severity-warning', 'severity-high', 'severity-critical');
    alert.classList.add(`severity-${severity}`);

    alert.classList.remove('hidden');
    // Force reflow for animation
    void alert.offsetWidth;
    alert.classList.add('visible');
}

/** Hide violation alert */
export function hideViolationAlert() {
    const alert = document.getElementById('violation-alert');
    if (!alert) return;
    alert.classList.remove('visible');
    setTimeout(() => alert.classList.add('hidden'), 500);
}

/** Setup close button for violation alert */
export function setupViolationClose() {
    const closeBtn = document.getElementById('violation-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideViolationAlert);
    }
}

/**
 * Simulate driving along a route
 * @param {Array<{lat: number, lng: number}>} coordinates
 * @param {Array} segments
 * @param {Function} onSpeedChange - called with (speed, position, segment)
 * @param {Function} onComplete - called when simulation ends
 * @returns {{ stop: Function }} - call stop() to end simulation
 */
export function simulateDrive(coordinates, segments, onSpeedChange, onComplete) {
    let index = 0;
    let running = true;
    const totalPoints = coordinates.length;

    // Speed profile: accelerate, cruise, slow in zones, decelerate
    function getSimulatedSpeed(progress, segment) {
        const limit = segment ? segment.speedLimit : 60;
        const baseSpeed = limit;

        // Random variation
        const variation = (Math.random() - 0.3) * 30;
        let speed = baseSpeed + variation;

        // Sometimes exceed limit for violation testing
        if (Math.random() < 0.25) {
            speed = limit + Math.random() * 40 + 5;
        }

        // Acceleration at start
        if (progress < 0.05) {
            speed *= progress / 0.05;
        }

        // Deceleration at end
        if (progress > 0.95) {
            speed *= (1 - progress) / 0.05;
        }

        return Math.max(0, Math.round(speed));
    }

    function step() {
        if (!running || index >= totalPoints) {
            if (onComplete) onComplete();
            return;
        }

        const pos = coordinates[index];
        const progress = index / totalPoints;

        // Find current segment
        let currentSegment = null;
        if (segments) {
            for (const seg of segments) {
                if (!seg.wayPoints) continue;
                for (const wp of seg.wayPoints) {
                    const d = Math.sqrt((pos.lat - wp.lat) ** 2 + (pos.lng - wp.lng) ** 2);
                    if (d < 0.01) {
                        currentSegment = seg;
                        break;
                    }
                }
                if (currentSegment) break;
            }
            if (!currentSegment && segments.length > 0) {
                // Default to proportional segment
                const segIdx = Math.min(
                    Math.floor(progress * segments.length),
                    segments.length - 1
                );
                currentSegment = segments[segIdx];
            }
        }

        const speed = getSimulatedSpeed(progress, currentSegment);

        // Calculate bearing
        let bearing = 0;
        if (index < totalPoints - 1) {
            const next = coordinates[index + 1];
            bearing = calculateBearing(pos.lat, pos.lng, next.lat, next.lng);
        }

        if (onSpeedChange) {
            onSpeedChange(speed, pos, currentSegment, bearing);
        }

        index++;

        // Vary update interval for realism
        const interval = 150 + Math.random() * 100;
        setTimeout(step, interval);
    }

    // Start simulation
    step();

    return {
        stop: () => {
            running = false;
        }
    };
}

/**
 * Show/hide UI sections
 */
export function showSection(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

export function hideSection(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

/**
 * Enable/disable find route button
 */
export function updateFindRouteBtn(sourceSet, destSet) {
    const btn = document.getElementById('find-route-btn');
    if (btn) btn.disabled = !(sourceSet && destSet);
}

/**
 * Display route info (distance, duration)
 */
export function displayRouteInfo(distance, duration) {
    document.getElementById('route-distance').textContent =
        distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
    document.getElementById('route-duration').textContent = formatDuration(duration);
    showSection('route-info');
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} min`;
}
