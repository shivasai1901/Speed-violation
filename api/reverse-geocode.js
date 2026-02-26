const axios = require('axios');

const ORS_BASE = 'https://api.openrouteservice.org';

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
        res.json({
            name: `${req.query.lat}, ${req.query.lng}`,
            lat: parseFloat(req.query.lat),
            lng: parseFloat(req.query.lng)
        });
    }
};
