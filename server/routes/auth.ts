import { Router, Request, Response } from 'express';
import {
  verifyAdminPassword,
  updateAdminPassword,
  generateToken,
  requireAdmin,
  rateLimitLogin,
  clearLoginAttempts,
} from '../auth.ts';
import { dbService } from '../db.ts';

const router = Router();

// Login endpoint
router.post('/login', rateLimitLogin, (req: Request, res: Response): void => {
  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const isValid = verifyAdminPassword(password);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  clearLoginAttempts(req);
  const token = generateToken('admin');
  res.json({
    token,
    user: {
      username: 'admin',
      role: 'admin',
    },
  });
});

// Verify token / check session
router.get('/me', requireAdmin, (req: Request, res: Response): void => {
  res.json({
    user: {
      username: 'admin',
      role: 'admin',
    },
  });
});

// Change admin password
router.post('/change-password', requireAdmin, (req: Request, res: Response): void => {
  const { currentPassword, newPassword } = req.body || {};

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long' });
    return;
  }

  if (currentPassword && !verifyAdminPassword(currentPassword)) {
    res.status(401).json({ error: 'Current password does not match' });
    return;
  }

  updateAdminPassword(newPassword);
  res.json({ success: true, message: 'Admin password successfully updated' });
});

// Auth status info (helps frontend show initial setup banner if default password is used)
router.get('/status', (req: Request, res: Response): void => {
  const customHashExists = !!dbService.getSetting('admin_password_hash');
  res.json({
    isConfigured: customHashExists,
    defaultPasswordHint: !customHashExists,
  });
});

export default router;
