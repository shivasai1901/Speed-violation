module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { speed, limit, weather } = req.body;
        const isViolation = speed > limit;
        const weatherPenalty = ['rain', 'snow', 'fog', 'thunderstorm'].includes(weather?.toLowerCase()) ? 10 : 0;
        const adjustedLimit = limit - weatherPenalty;

        res.json({
            violation: speed > adjustedLimit,
            probability: Math.min(1, Math.max(0, (speed - adjustedLimit) / adjustedLimit)),
            recommended_speed: adjustedLimit,
            message: isViolation
                ? `⚠️ Speed violation! You are going ${speed} km/h in a ${limit} km/h zone.`
                : 'Speed is within limits.',
            weather_advisory: weatherPenalty > 0
                ? `Reduce speed by ${weatherPenalty} km/h due to ${weather} conditions.`
                : null
        });
    } catch (error) {
        console.error('Predict error:', error.message);
        res.status(500).json({ error: 'Prediction failed' });
    }
};
