"""
Generate synthetic training data for speed violation ML model.
Features: current_speed, speed_limit, weather_code, visibility_km, road_type, hour_of_day
Target: violation (0 or 1), recommended_speed
"""
import pandas as pd
import numpy as np
import os

np.random.seed(42)

N = 10000

# Weather codes: 0=clear, 1=clouds, 2=rain, 3=snow, 4=fog, 5=thunderstorm
weather_codes = np.random.choice([0, 1, 2, 3, 4, 5], N, p=[0.35, 0.25, 0.15, 0.08, 0.10, 0.07])

# Road types: 0=highway, 1=national, 2=state, 3=city, 4=residential
road_types = np.random.choice([0, 1, 2, 3, 4], N, p=[0.15, 0.20, 0.20, 0.30, 0.15])

# Speed limits based on road type
speed_limit_map = {0: 120, 1: 100, 2: 80, 3: 60, 4: 30}
speed_limits = np.array([speed_limit_map[r] for r in road_types])

# Weather penalty on limit
weather_penalty = {0: 0, 1: 0, 2: 10, 3: 20, 4: 15, 5: 25}
penalties = np.array([weather_penalty[w] for w in weather_codes])
adjusted_limits = speed_limits - penalties

# Visibility (km)
visibility_map = {0: 10, 1: 8, 2: 5, 3: 3, 4: 2, 5: 4}
visibility = np.array([visibility_map[w] + np.random.uniform(-1, 1) for w in weather_codes])
visibility = np.clip(visibility, 0.5, 15)

# Hour of day
hours = np.random.randint(0, 24, N)

# Current speed: mix of compliant and violating drivers
current_speed = np.zeros(N)
for i in range(N):
    if np.random.random() < 0.35:  # 35% violators
        current_speed[i] = speed_limits[i] + np.random.uniform(5, 50)
    else:
        current_speed[i] = speed_limits[i] - np.random.uniform(0, 30)
current_speed = np.clip(current_speed, 5, 200)

# Violation: speed > adjusted limit
violation = (current_speed > adjusted_limits).astype(int)

# Recommended speed: adjusted limit capped at speed limit
recommended_speed = np.clip(adjusted_limits, 20, speed_limits)

df = pd.DataFrame({
    'current_speed': np.round(current_speed, 1),
    'speed_limit': speed_limits,
    'weather_code': weather_codes,
    'visibility_km': np.round(visibility, 1),
    'road_type': road_types,
    'hour_of_day': hours,
    'violation': violation,
    'recommended_speed': recommended_speed
})

output_path = os.path.join(os.path.dirname(__file__), 'training_data.csv')
df.to_csv(output_path, index=False)
print(f"[OK] Generated {N} training samples -> {output_path}")
print(f"   Violation rate: {violation.mean()*100:.1f}%")
print(df.describe())
