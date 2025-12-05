import express from 'express';
import Joi from 'joi';
import { UserRepository } from '../repositories/UserRepository';
import { generateToken, authenticate } from '../middleware/auth';
import { ApiResponse, IUser } from '../types';
import { Request as ExpressRequest } from 'express';
import { verifyGoogleToken } from '../utils/googleAuth';

const router = express.Router();
const userRepo = new UserRepository();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const googleLoginSchema = Joi.object({
  idToken: Joi.string().required()
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(50),
  lastName: Joi.string().min(1).max(50),
  avatar: Joi.string().uri()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { email, password, firstName, lastName } = value;

    // Check if user already exists
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      } as ApiResponse);
    }

    // Hash password before saving
    const salt = await import('bcryptjs').then(bcrypt => bcrypt.genSalt(12));
    const hashedPassword = await import('bcryptjs').then(bcrypt => bcrypt.hash(password, salt));

    // Create new user
    const user = await userRepo.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName
    });

    // Generate token
    const token = generateToken(user as any);

    return res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      },
      message: 'User registered successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { email, password } = value;

    // Find user by email
    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      } as ApiResponse);
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      } as ApiResponse);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      } as ApiResponse);
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user as any);

    return res.json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      },
      message: 'Login successful'
    } as ApiResponse);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { error, value } = googleLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { idToken } = value;

    // Verify Google ID token
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(idToken);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Google token'
      } as ApiResponse);
    }

    // Check if user exists
    let user = await userRepo.findByEmail(googleUser.email);

    if (user) {
      // Update user info from Google if they exist
      user.firstName = googleUser.given_name || googleUser.name.split(' ')[0] || user.firstName;
      user.lastName = googleUser.family_name || googleUser.name.split(' ').slice(1).join(' ') || user.lastName;
      user.avatar = googleUser.picture || user.avatar;

      // Update last login
      await user.updateLastLogin();
    } else {
      // Create new user from Google data
      const salt = await import('bcryptjs').then(bcrypt => bcrypt.genSalt(12));
      const hashedPassword = await import('bcryptjs').then(bcrypt =>
        bcrypt.hash(Math.random().toString(36).slice(-12), salt)
      );

      user = await userRepo.create({
        email: googleUser.email.toLowerCase(),
        password: hashedPassword,
        firstName: googleUser.given_name || googleUser.name.split(' ')[0] || 'User',
        lastName: googleUser.family_name || googleUser.name.split(' ').slice(1).join(' ') || '',
        avatar: googleUser.picture,
        isActive: true
      });
    }

    // Generate JWT token
    const token = generateToken(user as any);

    return res.json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      },
      message: 'Google login successful'
    } as ApiResponse);
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: ExpressRequest & { user?: IUser }, res) => {
  try {
    const user = await userRepo.findById(req.user!._id);

    return res.json({
      success: true,
      data: { user: user ? user.toJSON() : req.user }
    } as ApiResponse);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Update user profile
router.put('/profile', authenticate, async (req: ExpressRequest & { user?: IUser }, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const user = await userRepo.update(
      req.user!._id,
      { ...value, updatedAt: new Date() }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: { user: user.toJSON() },
      message: 'Profile updated successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Change password
router.put('/change-password', authenticate, async (req: ExpressRequest & { user?: IUser }, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { currentPassword, newPassword } = value;

    // Get user with password
    const user = await userRepo.findById(req.user!._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      } as ApiResponse);
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      } as ApiResponse);
    }

    // Update password
    const salt = await import('bcryptjs').then(bcrypt => bcrypt.genSalt(12));
    const hashedPassword = await import('bcryptjs').then(bcrypt => bcrypt.hash(newPassword, salt));
    user.password = hashedPassword;
    await user.save();

    return res.json({
      success: true,
      message: 'Password changed successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticate, (req: ExpressRequest & { user?: IUser }, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  } as ApiResponse);
});

// Verify token
router.get('/verify', authenticate, (req: ExpressRequest & { user?: IUser }, res) => {
  res.json({
    success: true,
    data: { user: req.user!.toJSON() }
  } as ApiResponse);
});

export default router;
