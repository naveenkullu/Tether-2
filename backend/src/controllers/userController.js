import mongoose from 'mongoose';
import Guardian from '../models/Guardian.js';
import GuardianNotificationLog from '../models/GuardianNotificationLog.js';
import MonitoringSession from '../models/MonitoringSession.js';
import User from '../models/User.js';

function requireObjectId(value, fieldName = 'userId') {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`${fieldName} must be a valid MongoDB ObjectId.`);
    error.status = 400;
    throw error;
  }
  return new mongoose.Types.ObjectId(value);
}

function serializeUser(user) {
  return {
    _id: user._id,
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    phone: user.phone,
    bloodGroup: user.bloodGroup,
    medicalNotes: user.medicalNotes,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeGuardian(guardian) {
  return {
    _id: guardian._id,
    id: String(guardian._id),
    name: guardian.name,
    relation: guardian.relation,
    phone: guardian.phone,
    email: guardian.email,
    avatarColor: guardian.avatarColor,
    isPrimary: guardian.isPrimary,
    createdAt: guardian.createdAt,
    updatedAt: guardian.updatedAt,
  };
}

async function findUserOrThrow(userId) {
  const user = await User.findById(requireObjectId(userId));
  if (!user) {
    const error = new Error('User was not found.');
    error.status = 404;
    throw error;
  }
  return user;
}

export async function getProfileHandler(req, res) {
  const user = await findUserOrThrow(req.params.userId);
  res.json({ user: serializeUser(user) });
}

export async function updateProfileHandler(req, res) {
  const user = await findUserOrThrow(req.params.userId);
  const allowed = ['name', 'email', 'phone', 'bloodGroup', 'medicalNotes', 'picture'];

  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      user[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    }
  }

  await user.save();
  res.json({ user: serializeUser(user) });
}

export async function listGuardiansHandler(req, res) {
  const user = requireObjectId(req.params.userId);
  const guardians = await Guardian.find({ user }).sort({ isPrimary: -1, createdAt: 1 });
  res.json({ guardians: guardians.map(serializeGuardian) });
}

export async function createGuardianHandler(req, res) {
  const user = requireObjectId(req.params.userId);
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  if (!name || !phone) {
    const error = new Error('Guardian name and phone are required.');
    error.status = 400;
    throw error;
  }

  const existingCount = await Guardian.countDocuments({ user });
  const guardian = await Guardian.create({
    user,
    name,
    phone,
    relation: String(req.body.relation || '').trim(),
    email: req.body.email ? String(req.body.email).trim().toLowerCase() : undefined,
    avatarColor: req.body.avatarColor,
    isPrimary: Boolean(req.body.isPrimary) || existingCount === 0,
  });

  res.status(201).json({ guardian: serializeGuardian(guardian) });
}

export async function updateGuardianHandler(req, res) {
  const user = requireObjectId(req.params.userId);
  const guardianId = requireObjectId(req.params.guardianId, 'guardianId');
  const patch = {};
  for (const field of ['name', 'relation', 'phone', 'email', 'avatarColor', 'isPrimary']) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      patch[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    }
  }

  const guardian = await Guardian.findOneAndUpdate(
    { _id: guardianId, user },
    { $set: patch },
    { new: true, runValidators: true },
  );
  if (!guardian) {
    const error = new Error('Guardian was not found.');
    error.status = 404;
    throw error;
  }

  res.json({ guardian: serializeGuardian(guardian) });
}

export async function deleteGuardianHandler(req, res) {
  const user = requireObjectId(req.params.userId);
  const guardianId = requireObjectId(req.params.guardianId, 'guardianId');
  await Guardian.deleteOne({ _id: guardianId, user });
  res.status(204).send();
}

export async function dashboardSummaryHandler(req, res) {
  const user = requireObjectId(req.params.userId);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [sessionsThisWeek, tripsTracked, alertsTriggered, activeGuardians, recentLogs] = await Promise.all([
    MonitoringSession.find({ user, startedAt: { $gte: weekStart } }).lean(),
    MonitoringSession.countDocuments({ user }),
    GuardianNotificationLog.countDocuments({ user, type: { $in: ['SOS', 'HIGH_RISK', 'RISK_INCREASED'] } }),
    Guardian.countDocuments({ user }),
    GuardianNotificationLog.find({ user }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const protectedMinutes = sessionsThisWeek.reduce((total, session) => {
    const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const start = new Date(session.startedAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);

  const timeline = recentLogs.map((log) => ({
    id: String(log._id),
    type: log.type === 'SOS' || log.type === 'HIGH_RISK' || log.type === 'RISK_INCREASED' ? 'alert' : 'guardian',
    title: log.payload?.subject || log.type.replaceAll('_', ' '),
    description: log.payload?.message || log.payload?.aiInsight || log.deliveryStatus,
    timestamp: log.createdAt,
  }));

  const recentAlerts = recentLogs
    .filter((log) => ['SOS', 'HIGH_RISK', 'RISK_INCREASED'].includes(log.type))
    .map((log) => ({
      id: String(log._id),
      title: log.type.replaceAll('_', ' '),
      description: log.payload?.message || log.payload?.area || log.deliveryStatus,
      resolved: log.deliveryStatus !== 'failed',
    }));

  res.json({
    stats: {
      protectedMinutes,
      tripsTracked,
      alertsTriggered,
      activeGuardians,
    },
    timeline,
    recentAlerts,
  });
}
