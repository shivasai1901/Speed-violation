const axios = require('axios');

const ORS_BASE = 'https://api.openrouteservice.org';

module.exports = async function handler(req, res) {
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
};
