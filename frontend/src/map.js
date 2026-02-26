/**
 * map.js — Leaflet map initialization, route rendering, markers
 */

let map = null;
let routeLayer = null;
let sourceMarker = null;
let destMarker = null;
let carMarker = null;
let segmentLayers = [];

/** Initialize the Leaflet map */
export function initMap() {
    map = L.map('map', {
        center: [20.5937, 78.9629], // India center
        zoom: 5,
        zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    return map;
}

/** Get the map instance */
export function getMap() {
    return map;
}

/** Create a custom icon */
function createIcon(emoji, size = 28) {
    return L.divIcon({
        html: `<div class="custom-marker" style="font-size:${size}px">${emoji}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        className: ''
    });
}

/** Set source marker */
export function setSourceMarker(lat, lng, name) {
    if (sourceMarker) map.removeLayer(sourceMarker);
    sourceMarker = L.marker([lat, lng], { icon: createIcon('🟢', 24) })
        .addTo(map)
        .bindPopup(`<b>Start:</b> ${name}`);
    return sourceMarker;
}

/** Set destination marker */
export function setDestMarker(lat, lng, name) {
    if (destMarker) map.removeLayer(destMarker);
    destMarker = L.marker([lat, lng], { icon: createIcon('🔴', 24) })
        .addTo(map)
        .bindPopup(`<b>End:</b> ${name}`);
    return destMarker;
}

/** Draw the route on the map */
export function drawRoute(coordinates, segments) {
    clearRoute();

    const latlngs = coordinates.map(c => [c.lat, c.lng]);

    // Draw colored segments based on speed limits
    if (segments && segments.length > 0) {
        segments.forEach(seg => {
            if (seg.wayPoints && seg.wayPoints.length >= 2) {
                const segLatLngs = seg.wayPoints.map(p => [p.lat, p.lng]);
                const color = getSpeedLimitColor(seg.speedLimit);
                const layer = L.polyline(segLatLngs, {
                    color: color,
                    weight: 5,
                    opacity: 0.8
                }).addTo(map);
                layer.bindPopup(`<b>${seg.name}</b><br>Speed Limit: ${seg.speedLimit} km/h<br>Distance: ${(seg.distance / 1000).toFixed(1)} km`);
                segmentLayers.push(layer);
            }
        });
    } else {
        // Fallback: single-color route
        routeLayer = L.polyline(latlngs, {
            color: '#00f5ff',
            weight: 5,
            opacity: 0.8
        }).addTo(map);
    }

    // Fit map to route
    const group = L.featureGroup([
        ...(sourceMarker ? [sourceMarker] : []),
        ...(destMarker ? [destMarker] : []),
        ...segmentLayers,
        ...(routeLayer ? [routeLayer] : [])
    ]);
    if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

/** Clear route from map */
export function clearRoute() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    segmentLayers.forEach(l => map.removeLayer(l));
    segmentLayers = [];
}

/** Color code by speed limit */
function getSpeedLimitColor(limit) {
    if (limit >= 100) return '#10b981';     // green — highway
    if (limit >= 80) return '#06b6d4';      // cyan — national
    if (limit >= 60) return '#f59e0b';      // yellow — city
    if (limit >= 40) return '#f97316';      // orange — slow
    return '#ef4444';                       // red — residential
}

/** Update or create car marker at a position */
export function updateCarMarker(lat, lng, bearing = 0) {
    if (!carMarker) {
        carMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `<div class="car-marker" style="transform:rotate(${bearing}deg)">🚗</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                className: ''
            }),
            zIndexOffset: 1000
        }).addTo(map);
    } else {
        carMarker.setLatLng([lat, lng]);
        carMarker.setIcon(L.divIcon({
            html: `<div class="car-marker" style="transform:rotate(${bearing}deg)">🚗</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            className: ''
        }));
    }
    return carMarker;
}

/** Remove car marker */
export function removeCarMarker() {
    if (carMarker) {
        map.removeLayer(carMarker);
        carMarker = null;
    }
}

/** Pan to a location */
export function panTo(lat, lng, zoom = 14) {
    map.setView([lat, lng], zoom);
}
