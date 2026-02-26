"""
Train a Random Forest model for speed violation prediction.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

BASE_DIR = os.path.dirname(__file__)

# Load data
data_path = os.path.join(BASE_DIR, 'training_data.csv')
if not os.path.exists(data_path):
    print("[WARN] Training data not found. Generating...")
    exec(open(os.path.join(BASE_DIR, 'generate_data.py')).read())

df = pd.read_csv(data_path)
print(f"[DATA] Loaded {len(df)} samples")

# Features
features = ['current_speed', 'speed_limit', 'weather_code', 'visibility_km', 'road_type', 'hour_of_day']
X = df[features]
y_violation = df['violation']
y_recommended = df['recommended_speed']

# Split
X_train, X_test, y_v_train, y_v_test = train_test_split(X, y_violation, test_size=0.2, random_state=42)
_, _, y_r_train, y_r_test = train_test_split(X, y_recommended, test_size=0.2, random_state=42)

# Train violation classifier
print("\n[TRAIN] Training violation classifier...")
clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
clf.fit(X_train, y_v_train)

y_pred = clf.predict(X_test)
print(f"   Accuracy: {accuracy_score(y_v_test, y_pred)*100:.1f}%")
print(classification_report(y_v_test, y_pred, target_names=['Safe', 'Violation']))

# Train recommended speed regressor
print("[TRAIN] Training recommended speed regressor...")
reg = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
reg.fit(X_train, y_r_train)
print(f"   R² Score: {reg.score(X_test, y_r_test):.3f}")

# Save models
clf_path = os.path.join(BASE_DIR, 'violation_model.pkl')
reg_path = os.path.join(BASE_DIR, 'speed_model.pkl')
joblib.dump(clf, clf_path)
joblib.dump(reg, reg_path)
print(f"\n[OK] Models saved:")
print(f"   Classifier -> {clf_path}")
print(f"   Regressor  -> {reg_path}")

# Save feature names for validation
import json
meta_path = os.path.join(BASE_DIR, 'model_meta.json')
with open(meta_path, 'w') as f:
    json.dump({'features': features, 'weather_codes': {
        'clear': 0, 'clouds': 1, 'rain': 2, 'snow': 3, 'fog': 4, 'mist': 4, 'haze': 4, 'thunderstorm': 5, 'drizzle': 2
    }}, f)
print(f"   Metadata   -> {meta_path}")
