import { Router } from 'express';
import { syncGoogleUserHandler } from '../controllers/authController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/auth/google', asyncHandler(syncGoogleUserHandler));

export default router;
