const express = require('express');
const axios = require('axios');
const router = express.Router();

const ORS_BASE = 'https://api.openrouteservice.org';

// Geocode / Autocomplete
router.get('/geocode', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

        const response = await axios.get(`${ORS_BASE}/geocode/autocomplete`, {
            params: {
                api_key: process.env.ORS_API_KEY,
                text: q,
                size: 5,
                layers: 'locality,county,region,address,venue'
            }
        });

        const results = response.data.features.map(f => ({
            name: f.properties.label,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            id: f.properties.id
        }));

        res.json(results);
    } catch (error) {
        console.error('Geocode error:', error.message);
        res.status(500).json({ error: 'Geocoding failed', details: error.message });
    }
});

// Get driving route with speed limits
router.get('/route', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ error: 'start and end coordinates required (lng,lat format)' });
        }

        const [startLng, startLat] = start.split(',').map(Number);
        const [endLng, endLat] = end.split(',').map(Number);

        // Try ORS first, then OSRM as fallback
        let result = null;

        try {
            result = await getRouteFromORS(startLng, startLat, endLng, endLat);
        } catch (orsError) {
            console.warn('ORS routing failed, trying OSRM fallback:', orsError.message);
        }

        if (!result) {
            try {
                result = await getRouteFromOSRM(startLng, startLat, endLng, endLat);
            } catch (osrmError) {
                console.error('OSRM routing also failed:', osrmError.message);
                return res.status(500).json({ error: 'All routing services failed', details: osrmError.message });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Route error:', error.message);
        res.status(500).json({ error: 'Routing failed', details: error.message });
    }
});

// ─── ORS Route ───
async function getRouteFromORS(startLng, startLat, endLng, endLat) {
    const response = await axios.post(
        `${ORS_BASE}/v2/directions/driving-car/geojson`,
        {
            coordinates: [[startLng, startLat], [endLng, endLat]],
            extra_info: ['waytypes', 'surface'],
            instructions: true
        },
        {
            headers: {
                Authorization: process.env.ORS_API_KEY,
                'Content-Type': 'application/json'
            }
        }
    );

    const feature = response.data.features[0];
    const coords = feature.geometry.coordinates;
    const summary = feature.properties.summary;
    const segments = feature.properties.segments;

    const routeSegments = [];
    if (segments && segments.length > 0) {
        for (const segment of segments) {
            for (const step of segment.steps) {
                const wayPoints = coords.slice(step.way_points[0], step.way_points[1] + 1);
                let speedLimit = estimateSpeedLimit(step.type, step.instruction);
                routeSegments.push({
                    instruction: step.instruction,
                    distance: step.distance,
                    duration: step.duration,
                    name: step.name || 'Unknown road',
                    speedLimit,
                    wayPoints: wayPoints.map(c => ({ lat: c[1], lng: c[0] }))
                });
            }
        }
    }

    return {
        coordinates: coords.map(c => ({ lat: c[1], lng: c[0] })),
        distance: summary.distance,
        duration: summary.duration,
        segments: routeSegments,
        bbox: feature.bbox
    };
}

// ─── OSRM Route (Free, no API key, follows real roads) ───
async function getRouteFromOSRM(startLng, startLat, endLng, endLat) {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true&annotations=true`;

    const response = await axios.get(url);

    if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
        throw new Error('OSRM returned no routes');
    }

    const route = response.data.routes[0];
    const coords = route.geometry.coordinates;
    const legs = route.legs;

    // Build segments from OSRM steps
    const routeSegments = [];
    for (const leg of legs) {
        for (const step of leg.steps) {
            if (step.geometry && step.geometry.coordinates.length >= 2) {
                const speedLimit = estimateSpeedLimitFromOSRM(step);
                routeSegments.push({
                    instruction: step.maneuver ? `${step.maneuver.type} ${step.maneuver.modifier || ''}`.trim() : 'Continue',
                    distance: step.distance,
                    duration: step.duration,
                    name: step.name || step.ref || 'Unknown road',
                    speedLimit,
                    wayPoints: step.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }))
                });
            }
        }
    }

    return {
        coordinates: coords.map(c => ({ lat: c[1], lng: c[0] })),
        distance: route.distance,
        duration: route.duration,
        segments: routeSegments,
        bbox: null
    };
}

// Estimate speed limit from OSRM step data
function estimateSpeedLimitFromOSRM(step) {
    const name = (step.name || '').toLowerCase();
    const ref = (step.ref || '').toLowerCase();
    const roadClass = (step.driving_side || '');

    // Check road name/ref for highway indicators
    if (ref.startsWith('nh') || name.includes('national highway') || name.includes('expressway')) {
        return 100;
    } else if (ref.startsWith('sh') || name.includes('state highway')) {
        return 80;
    } else if (name.includes('highway') || name.includes('bypass') || name.includes('ring road')) {
        return 80;
    } else if (name.includes('main road') || name.includes('trunk')) {
        return 60;
    } else if (name.includes('service') || name.includes('residential') || name.includes('lane') || name.includes('gali')) {
        return 30;
    } else if (step.maneuver && (step.maneuver.type === 'roundabout turn' || step.maneuver.type === 'rotary')) {
        return 25;
    }

    // Estimate from average speed of the step
    if (step.distance > 0 && step.duration > 0) {
        const avgSpeedKmh = (step.distance / step.duration) * 3.6;
        if (avgSpeedKmh > 80) return 100;
        if (avgSpeedKmh > 50) return 80;
        if (avgSpeedKmh > 30) return 60;
        return 40;
    }

    return 60; // Default
}

// Estimate speed limit based on road/step type
function estimateSpeedLimit(stepType, instruction) {
    const inst = (instruction || '').toLowerCase();
    // ORS step types: 0=left, 1=right, 2=sharp left, 3=sharp right, 4=slight left,
    // 5=slight right, 6=straight, 7=enter roundabout, 8=exit roundabout,
    // 9=u-turn, 10=goal, 11=depart, 12=keep left, 13=keep right

    if (inst.includes('highway') || inst.includes('expressway') || inst.includes('motorway')) {
        return 120;
    } else if (inst.includes('national') || inst.includes('trunk')) {
        return 100;
    } else if (inst.includes('state') || inst.includes('major')) {
        return 80;
    } else if (inst.includes('residential') || inst.includes('service')) {
        return 30;
    } else if (inst.includes('roundabout') || stepType === 7 || stepType === 8) {
        return 25;
    } else {
        return 60; // Default city road
    }
}

// Reverse geocode
router.get('/reverse-geocode', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

        const response = await axios.get(`${ORS_BASE}/geocode/reverse`, {
            params: {
                api_key: process.env.ORS_API_KEY,
                'point.lat': lat,
                'point.lon': lng,
                size: 1
            }
        });

        const feature = response.data.features[0];
        res.json({
            name: feature ? feature.properties.label : `${lat}, ${lng}`,
            lat: parseFloat(lat),
            lng: parseFloat(lng)
        });
    } catch (error) {
        console.error('Reverse geocode error:', error.message);
        res.json({ name: `${req.query.lat}, ${req.query.lng}`, lat: parseFloat(req.query.lat), lng: parseFloat(req.query.lng) });
    }
});

module.exports = router;
