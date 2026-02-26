"""
Flask micro-service for speed violation ML prediction.
Runs on port 5000.
"""
from flask import Flask, request, jsonify
import joblib
import numpy as np
import json
import os

app = Flask(__name__)
BASE_DIR = os.path.dirname(__file__)

# Load models
clf = None
reg = None
meta = None

def load_models():
    global clf, reg, meta
    clf_path = os.path.join(BASE_DIR, 'violation_model.pkl')
    reg_path = os.path.join(BASE_DIR, 'speed_model.pkl')
    meta_path = os.path.join(BASE_DIR, 'model_meta.json')

    if os.path.exists(clf_path) and os.path.exists(reg_path):
        clf = joblib.load(clf_path)
        reg = joblib.load(reg_path)
        with open(meta_path) as f:
            meta = json.load(f)
        print("[OK] Models loaded successfully")
    else:
        print("[WARN] Models not found. Run train_model.py first.")

load_models()

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        speed = float(data.get('speed', 0))
        limit = float(data.get('limit', 60))
        weather = str(data.get('weather', 'clear')).lower()
        visibility = float(data.get('visibility', 10))
        road_type = int(data.get('road_type', 3))  # default city
        hour = int(data.get('hour', 12))

        # Map weather string to code
        weather_code = 0
        if meta:
            weather_code = meta['weather_codes'].get(weather, 0)

        if clf is not None and reg is not None:
            # ML prediction
            features = np.array([[speed, limit, weather_code, visibility, road_type, hour]])
            violation_pred = clf.predict(features)[0]
            violation_prob = clf.predict_proba(features)[0][1]  # probability of violation
            recommended = reg.predict(features)[0]
        else:
            # Fallback rule-based
            weather_penalties = {'clear': 0, 'clouds': 0, 'rain': 10, 'snow': 20, 'fog': 15, 'thunderstorm': 25}
            penalty = weather_penalties.get(weather, 0)
            adjusted = limit - penalty
            violation_pred = int(speed > adjusted)
            violation_prob = min(1.0, max(0, (speed - adjusted) / adjusted)) if adjusted > 0 else 1.0
            recommended = max(20, adjusted)

        recommended = round(float(recommended), 0)

        # Build response
        response = {
            'violation': bool(violation_pred),
            'probability': round(float(violation_prob), 3),
            'current_speed': speed,
            'speed_limit': limit,
            'recommended_speed': recommended,
            'weather': weather,
            'message': '',
            'severity': 'safe',
            'weather_advisory': None
        }

        if violation_pred:
            over = speed - limit
            if over > 30:
                response['severity'] = 'critical'
                response['message'] = f'🚨 CRITICAL: {speed:.0f} km/h in {limit:.0f} km/h zone! Slow down immediately!'
            elif over > 15:
                response['severity'] = 'high'
                response['message'] = f'⚠️ HIGH: Exceeding limit by {over:.0f} km/h. Reduce speed to {recommended:.0f} km/h.'
            else:
                response['severity'] = 'warning'
                response['message'] = f'⚡ WARNING: Slightly over the limit. Recommended: {recommended:.0f} km/h.'
        else:
            response['message'] = f'✅ Speed OK: {speed:.0f} km/h (limit: {limit:.0f} km/h)'

        # Weather advisory
        if weather_code >= 2:
            weather_names = {2: 'rain', 3: 'snow', 4: 'fog/low visibility', 5: 'thunderstorm'}
            response['weather_advisory'] = f'🌧️ Caution: {weather_names.get(weather_code, weather)} detected. Recommended max speed: {recommended:.0f} km/h.'

        return jsonify(response)

    except Exception as e:
        return jsonify({'error': str(e), 'violation': False}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'models_loaded': clf is not None,
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
