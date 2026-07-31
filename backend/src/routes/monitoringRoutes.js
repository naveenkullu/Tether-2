import { Router } from 'express';
import {
  currentMonitoringHandler,
  notificationLogsHandler,
  riskEvaluationHandler,
  sessionHistoryHandler,
  startMonitoringHandler,
  stopMonitoringHandler,
  triggerEmergencyHandler,
  updateMonitoringHandler,
} from '../controllers/monitoringController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/monitoring/start', asyncHandler(startMonitoringHandler));
router.post('/monitoring/emergency', asyncHandler(triggerEmergencyHandler));
router.post('/monitoring/update', asyncHandler(updateMonitoringHandler));
router.post('/monitoring/stop', asyncHandler(stopMonitoringHandler));
router.get('/monitoring/current', asyncHandler(currentMonitoringHandler));
router.get('/monitoring/history', asyncHandler(sessionHistoryHandler));
router.get('/monitoring/risk', asyncHandler(riskEvaluationHandler));
router.get('/monitoring/notification-logs', asyncHandler(notificationLogsHandler));

export default router;
