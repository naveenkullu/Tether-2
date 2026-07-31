import mongoose from 'mongoose';
import User from '../models/User.js';
import MonitoringSession from '../models/MonitoringSession.js';
import RiskSnapshot from '../models/RiskSnapshot.js';
import LocationHistory from '../models/LocationHistory.js';
import GuardianNotificationLog from '../models/GuardianNotificationLog.js';
import { evaluateRisk } from './riskEngine.js';
import {
  notifyMonitoringEnded,
  notifyRiskChange,
  notifySafeWalkStarted,
} from './notificationService.js';

function normalizeObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`${fieldName} must be a valid MongoDB ObjectId.`);
    error.status = 400;
    throw error;
  }
  return new mongoose.Types.ObjectId(value);
}

async function normalizeUserId(value, extraUserInfo = {}) {
  if (mongoose.Types.ObjectId.isValid(value)) {
    const user = await User.findById(value);
    if (user) return user._id;
  }

  const strVal = String(value || 'guest_000').trim();
  let user = await User.findOne({ $or: [{ googleId: strVal }, { email: strVal.toLowerCase() }] });

  if (!user) {
    const email = extraUserInfo.userEmail || (strVal.includes('@') ? strVal : `user_${Date.now()}@tether.app`);
    const name = extraUserInfo.userName || 'Tether User';
    user = await User.create({
      googleId: strVal,
      email: email.toLowerCase(),
      name,
    });
  }

  return user._id;
}

function parseLocation(body) {
  const latitude = Number(body.latitude ?? body.lat ?? body.location?.latitude ?? body.location?.lat);
  const longitude = Number(body.longitude ?? body.lng ?? body.location?.longitude ?? body.location?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error('latitude and longitude are required numeric values.');
    error.status = 400;
    throw error;
  }

  return { latitude, longitude };
}

function parseCapturedAt(timestamp) {
  const capturedAt = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(capturedAt.getTime())) {
    const error = new Error('timestamp must be a valid date.');
    error.status = 400;
    throw error;
  }
  return capturedAt;
}

function normalizePlaces(places = []) {
  if (!Array.isArray(places)) return [];
  return places.map((place) => ({
    id: place.id,
    name: place.name,
    type: place.type,
    distanceKm: place.distanceKm,
    latitude: place.latitude ?? place.lat,
    longitude: place.longitude ?? place.lng,
  }));
}

function guardiansFromBody(body) {
  if (Array.isArray(body.guardians)) return body.guardians;
  return (Array.isArray(body.guardianIds) ? body.guardianIds : [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

export async function startMonitoring(body) {
  const user = await normalizeUserId(body.userId);
  const location = parseLocation(body);
  const activeSession = await MonitoringSession.findOne({ user, status: 'active' });

  if (activeSession) {
    const error = new Error('An active monitoring session already exists for this user.');
    error.status = 409;
    throw error;
  }

  const session = await MonitoringSession.create({
    user,
    startLocation: location,
    lastSnapshotAt: new Date(),
    lastRiskScore: Number(body.currentSafeScore ?? 100),
    lastRiskLevel: body.currentRiskLevel ?? 'Low',
    metadata: body.metadata || {},
  });

  await notifySafeWalkStarted(session, guardiansFromBody(body), {
    location,
    weather: body.weather,
    dayNight: body.dayNight,
    aiInsight: body.aiInsight,
    currentSafeScore: body.currentSafeScore,
    currentRiskLevel: body.currentRiskLevel,
    nearbySafePlaces: body.nearbySafePlaces,
    nearbyPoliceStations: body.nearbyPoliceStations,
    nearbyHospitals: body.nearbyHospitals,
    batteryLevel: body.batteryLevel,
    walkingSpeedKmph: body.walkingSpeedKmph,
    timestamp: body.timestamp,
  });
  return session;
}

export async function updateMonitoring(body) {
  const user = await normalizeUserId(body.userId);
  const sessionId = normalizeObjectId(body.sessionId, 'sessionId');
  const session = await MonitoringSession.findOne({ _id: sessionId, user, status: 'active' });

  if (!session) {
    const error = new Error('Active monitoring session was not found.');
    error.status = 404;
    throw error;
  }

  const location = parseLocation(body);
  const capturedAt = parseCapturedAt(body.timestamp);
  const nearbyPoliceStations = normalizePlaces(body.nearbyPoliceStations);
  const nearbyHospitals = normalizePlaces(body.nearbyHospitals);
  const nearbySafePlaces = normalizePlaces(body.nearbySafePlaces);
  const previousScore = session.lastRiskScore ?? 100;
  const riskInput = {
    ...body,
    dayNight: body.dayNight || 'unknown',
    nearbyPoliceStations,
    nearbyHospitals,
    nearbySafePlaces,
    walkingSpeedKmph: body.walkingSpeedKmph ?? body.walkingSpeed,
    isSos: Boolean(body.isSos || body.sos),
  };
  const evaluation = evaluateRisk(riskInput);

  const snapshot = await RiskSnapshot.create({
    session: session._id,
    user,
    location,
    capturedAt,
    clientSafeScore: body.currentSafeScore,
    score: evaluation.score,
    risk: evaluation.risk,
    reasons: evaluation.reasons,
    weather: body.weather || null,
    dayNight: body.dayNight || 'unknown',
    nearbySafePlaces,
    nearbyPoliceStations,
    nearbyHospitals,
    aiInsight: body.aiInsight || null,
    batteryLevel: body.batteryLevel,
    walkingSpeedKmph: riskInput.walkingSpeedKmph,
    isSos: riskInput.isSos,
    isUnsafeArea: Boolean(body.isUnsafeArea || body.unsafeArea),
    isCrowdedArea: Boolean(body.isCrowdedArea || body.crowdedArea),
    stoppedUnexpectedly: Boolean(body.stoppedUnexpectedly),
    longInactivity: Boolean(body.longInactivity),
    rawPayload: body,
  });

  await LocationHistory.create({
    session: session._id,
    user,
    latitude: location.latitude,
    longitude: location.longitude,
    capturedAt,
    accuracyMeters: body.accuracyMeters ?? body.accuracy,
    speedKmph: riskInput.walkingSpeedKmph,
  });

  session.lastSnapshotAt = capturedAt;
  session.lastRiskScore = snapshot.score;
  session.lastRiskLevel = snapshot.risk;
  if (snapshot.isSos) session.status = 'sos';
  await session.save();

  const notifications = await notifyRiskChange({
    session,
    snapshot,
    previousScore,
    guardians: guardiansFromBody(body),
  });

  return { session, snapshot, evaluation, notifications };
}

export async function stopMonitoring(body) {
  const user = await normalizeUserId(body.userId);
  const sessionId = normalizeObjectId(body.sessionId, 'sessionId');
  const session = await MonitoringSession.findOne({
    _id: sessionId,
    user,
    status: { $in: ['active', 'sos'] },
  });

  if (!session) {
    const error = new Error('Monitoring session was not found.');
    error.status = 404;
    throw error;
  }

  session.status = 'ended';
  session.endedAt = new Date();
  if (body.latitude || body.longitude || body.location) {
    session.endLocation = parseLocation(body);
  }
  await session.save();

  await notifyMonitoringEnded(session, guardiansFromBody(body));
  return session;
}

export async function getCurrentMonitoring(userId) {
  const user = await normalizeUserId(userId);
  const session = await MonitoringSession.findOne({ user, status: { $in: ['active', 'sos'] } })
    .sort({ startedAt: -1 })
    .lean();

  if (!session) return null;

  const latestSnapshot = await RiskSnapshot.findOne({ session: session._id })
    .sort({ capturedAt: -1 })
    .lean();

  return { session, latestSnapshot };
}

export async function getSessionHistory(userId, limit = 20) {
  const user = await normalizeUserId(userId);
  return MonitoringSession.find({ user })
    .sort({ startedAt: -1 })
    .limit(Math.min(Number(limit) || 20, 100))
    .lean();
}

export async function getNotificationLogs(userId, limit = 50) {
  const user = await normalizeUserId(userId);
  return GuardianNotificationLog.find({ user })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();
}

export async function triggerEmergencyDirect(body) {
  const user = await normalizeUserId(body.userId || 'guest_000', {
    userEmail: body.userEmail,
    userName: body.userName,
  });

  const location = parseLocation(body);
  const guardians = guardiansFromBody(body);

  let session = await MonitoringSession.findOne({ user, status: { $in: ['active', 'sos'] } });
  if (!session) {
    session = await MonitoringSession.create({
      user,
      startLocation: location,
      lastSnapshotAt: new Date(),
      lastRiskScore: 100,
      lastRiskLevel: 'Critical',
      status: 'sos',
      metadata: { emergencyTriggered: true },
    });
  } else {
    session.status = 'sos';
    session.lastRiskScore = 100;
    session.lastRiskLevel = 'Critical';
    await session.save();
  }

  const snapshot = await RiskSnapshot.create({
    session: session._id,
    user,
    location,
    capturedAt: new Date(),
    score: 100,
    risk: 'Critical',
    reasons: ['EMERGENCY SOS Triggered by User'],
    isSos: true,
  });

  const notification = await notifySafeWalkStarted(session, guardians, {
    location,
    isSos: true,
    message: 'EMERGENCY SOS Triggered!',
    userName: body.userName,
    userEmail: body.userEmail,
    userPhone: body.userPhone,
  });

  return { session, snapshot, notification };
}

export { evaluateRisk };
