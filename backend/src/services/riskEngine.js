const RISK_LEVELS = [
  { min: 80, risk: 'Critical' },
  { min: 60, risk: 'High' },
  { min: 35, risk: 'Medium' },
  { min: 0, risk: 'Low' },
];

const clampScore = (score) => Math.max(0, Math.min(100, Math.round(score)));

const asArray = (value) => (Array.isArray(value) ? value : []);

const includesAny = (value, words) => {
  const text = String(value || '').toLowerCase();
  return words.some((word) => text.includes(word));
};

export function getRiskLevel(score) {
  const match = RISK_LEVELS.find((level) => score >= level.min);
  return match?.risk || 'Low';
}

export function evaluateRisk(input = {}) {
  let score = 100;
  const reasons = [];

  const weather = input.weather || {};
  const weatherText = [
    weather.condition,
    weather.summary,
    weather.description,
    weather.main,
  ].join(' ');
  const policeStations = asArray(input.nearbyPoliceStations);
  const hospitals = asArray(input.nearbyHospitals);
  const safePlaces = asArray(input.nearbySafePlaces);
  const batteryLevel = Number(input.batteryLevel);
  const walkingSpeedKmph = Number(input.walkingSpeedKmph ?? input.currentSpeed);

  const apply = (points, reason) => {
    score -= points;
    reasons.push(reason);
  };

  if (input.isSos || input.sos) apply(55, 'SOS triggered');
  if (input.dayNight === 'night' || input.isNight) apply(14, 'Night time');
  if (includesAny(weatherText, ['rain', 'drizzle', 'shower']) || weather.isRaining) {
    apply(Number(weather.precipitation || 0) >= 10 ? 14 : 9, Number(weather.precipitation || 0) >= 10 ? 'Heavy rain' : 'Rain');
  }
  if (includesAny(weatherText, ['storm', 'thunder', 'lightning']) || weather.isStorm) apply(18, 'Storm nearby');
  if (!Number.isNaN(batteryLevel) && batteryLevel <= 15) apply(14, 'Low battery');
  if (input.isUnsafeArea || input.unsafeArea) apply(18, 'Unsafe area');
  if (policeStations.length === 0) apply(10, 'No nearby police station');
  if (hospitals.length === 0) apply(8, 'No nearby hospital');
  if (input.stoppedUnexpectedly) apply(13, 'Stopped moving unexpectedly');
  if (input.longInactivity) apply(16, 'Long inactivity');
  if (input.isCrowdedArea || input.crowdedArea) apply(7, 'Crowded area');

  if (!Number.isNaN(walkingSpeedKmph)) {
    if (walkingSpeedKmph < 0.4) apply(8, 'Very low walking speed');
    if (walkingSpeedKmph > 8) apply(8, 'Unusual walking speed');
  }

  if (safePlaces.length > 0) {
    score += 7;
    reasons.push('Nearby safe place');
  }

  score = clampScore(score);

  return {
    score,
    risk: getRiskLevel(100 - score),
    reasons,
  };
}
