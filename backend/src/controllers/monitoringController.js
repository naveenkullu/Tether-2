import {
  evaluateRisk,
  getCurrentMonitoring,
  getNotificationLogs,
  getSessionHistory,
  startMonitoring,
  stopMonitoring,
  triggerEmergencyDirect,
  updateMonitoring,
} from '../services/monitoringService.js';

export async function startMonitoringHandler(req, res) {
  const session = await startMonitoring(req.body);
  res.status(201).json({ session });
}

export async function triggerEmergencyHandler(req, res) {
  const result = await triggerEmergencyDirect(req.body);
  res.status(201).json(result);
}

export async function updateMonitoringHandler(req, res) {
  const result = await updateMonitoring(req.body);
  res.status(201).json(result);
}

export async function stopMonitoringHandler(req, res) {
  const session = await stopMonitoring(req.body);
  res.json({ session });
}

export async function currentMonitoringHandler(req, res) {
  const current = await getCurrentMonitoring(req.query.userId);
  res.json(current || { session: null, latestSnapshot: null });
}

export async function sessionHistoryHandler(req, res) {
  const sessions = await getSessionHistory(req.query.userId, req.query.limit);
  res.json({ sessions });
}

export async function riskEvaluationHandler(req, res) {
  res.json(evaluateRisk(req.query));
}

export async function notificationLogsHandler(req, res) {
  const logs = await getNotificationLogs(req.query.userId, req.query.limit);
  res.json({ logs });
}
