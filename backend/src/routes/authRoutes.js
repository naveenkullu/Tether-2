import { Router } from 'express';
import { createGuestUserHandler, syncGoogleUserHandler } from '../controllers/authController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/auth/google', asyncHandler(syncGoogleUserHandler));
router.post('/auth/guest', asyncHandler(createGuestUserHandler));

export default router;
