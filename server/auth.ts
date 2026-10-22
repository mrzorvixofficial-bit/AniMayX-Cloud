import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from './config.ts';
import { dbService } from './db.ts';

// In-memory rate limiting map for login attempts
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

export function getAdminPasswordHash(): string {
  // Check if updated in database
  let dbHash = dbService.getSetting('admin_password_hash');
  if (dbHash) {
    // If the stored hash is the old default 'admin', migrate it to the new default 'Master'
    try {
      if (bcrypt.compareSync('admin', dbHash)) {
        const newHash = bcrypt.hashSync(config.adminPassword || 'Master', 10);
        dbService.setSetting('admin_password_hash', newHash);
        return newHash;
      }
    } catch (e) {
      console.warn('Failed to verify/migrate old default password hash:', e);
    }
    return dbHash;
  }

  // Check if configured via environment variable
  if (config.adminPasswordHash && config.adminPasswordHash.startsWith('$2')) {
    return config.adminPasswordHash;
  }

  // Fallback to hashing ADMIN_PASSWORD and persisting it
  const defaultHash = bcrypt.hashSync(config.adminPassword || 'Master', 10);
  dbService.setSetting('admin_password_hash', defaultHash);
  return defaultHash;
}

export function verifyAdminPassword(password: string): boolean {
  try {
    const currentHash = getAdminPasswordHash();
    return bcrypt.compareSync(password, currentHash);
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

export function updateAdminPassword(newPassword: string): void {
  const newHash = bcrypt.hashSync(newPassword, 10);
  dbService.setSetting('admin_password_hash', newHash);
}

export function generateToken(username: string = 'admin'): string {
  return jwt.sign(
    {
      sub: username,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
    },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): { sub: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; role: string };
    if (decoded && decoded.role === 'admin') {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

// Authentication Middleware for Protected APIs
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Admin authentication token required' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session token' });
    return;
  }

  (req as unknown as { user: typeof payload }).user = payload;
  next();
}

// Rate Limiting Middleware for Login
export function rateLimitLogin(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10; // 10 attempts allowed

  const record = loginAttempts.get(ip);

  if (record) {
    if (now > record.resetTime) {
      loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxAttempts) {
      const waitMinutes = Math.ceil((record.resetTime - now) / 60000);
      res.status(429).json({
        error: `Too many failed login attempts. Please try again in ${waitMinutes} minutes.`,
      });
      return;
    }

    record.count += 1;
  } else {
    loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
  }

  next();
}

export function clearLoginAttempts(req: Request): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  loginAttempts.delete(ip);
}
