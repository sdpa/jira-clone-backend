import { Request, Response, NextFunction } from 'express';
import { Request as ExpressRequest } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { IUser, AuthenticatedRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

// Generate JWT token
export const generateToken = (user: IUser): string => {
  const payload: JWTPayload = {
    userId: user._id,
    email: user.email,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

// Authentication middleware
export const authenticate = async (
  req: ExpressRequest & { user?: IUser },
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token is required'
      });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'Invalid or inactive user'
        });
        return;
      }
      
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Authorization middleware - check if user has required role
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }
    
    next();
  };
};

// Optional authentication middleware - doesn't fail if no token
export const optionalAuth = async (
  req: ExpressRequest & { user?: IUser },
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Check if user owns resource or is admin
export const authorizeOwnerOrAdmin = (getUserId: (req: Request) => string) => {
  return (req: ExpressRequest & { user?: IUser }, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }
    
    const resourceUserId = getUserId(req);
    const isOwner = req.user._id.toString() === resourceUserId;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }
    
    next();
  };
};

// Check if user is project member or admin
export const authorizeProjectMember = (getProjectId: (req: Request) => string) => {
  return async (req: ExpressRequest & { user?: IUser }, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role === 'admin') {
        next();
        return;
      }
      
      const projectId = getProjectId(req);
      const { Project } = await import('../models/Project');
      const project = await Project.findById(projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        });
        return;
      }
      
      const isMember = project.isMember(req.user._id.toString());
      
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'You are not a member of this project'
        });
        return;
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Authorization error'
      });
    }
  };
};
