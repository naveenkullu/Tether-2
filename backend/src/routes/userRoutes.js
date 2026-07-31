import { Router } from 'express';
import {
  createGuardianHandler,
  dashboardSummaryHandler,
  deleteGuardianHandler,
  getProfileHandler,
  listGuardiansHandler,
  updateGuardianHandler,
  updateProfileHandler,
} from '../controllers/userController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/users/:userId/profile', asyncHandler(getProfileHandler));
router.put('/users/:userId/profile', asyncHandler(updateProfileHandler));
router.get('/users/:userId/guardians', asyncHandler(listGuardiansHandler));
router.post('/users/:userId/guardians', asyncHandler(createGuardianHandler));
router.put('/users/:userId/guardians/:guardianId', asyncHandler(updateGuardianHandler));
router.delete('/users/:userId/guardians/:guardianId', asyncHandler(deleteGuardianHandler));
router.get('/users/:userId/dashboard', asyncHandler(dashboardSummaryHandler));

export default router;
