import dotenv from 'dotenv';

// Load environment variables FIRST - before any other imports that might use them
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

// Import routes
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import issueRoutes from './routes/issues';
import commentRoutes from './routes/comments';

// Import middleware
import { authenticate } from './middleware/auth';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jira-clone';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'JIRA Clone API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Environment check endpoint (for debugging)
app.get('/api/env-check', (req, res) => {
  res.json({
    success: true,
    data: {
      nodeEnv: process.env.NODE_ENV || 'not set',
      port: process.env.PORT || 'not set',
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      googleClientIdLength: (process.env.GOOGLE_CLIENT_ID || '').length,
      googleClientIdPreview: process.env.GOOGLE_CLIENT_ID 
        ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` 
        : 'NOT SET'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/comments', commentRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((error: any) => error.message);
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: `${field} already exists`
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired'
    });
  }
  
  // Default error
  return res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Socket.IO for real-time updates
const connectedUsers = new Map<string, string>(); // socketId -> userId

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const { verifyToken } = await import('./middleware/auth');
    const decoded = verifyToken(token);
    
    socket.data.userId = decoded.userId;
    connectedUsers.set(socket.id, decoded.userId);
    
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User ${socket.data.userId} connected with socket ${socket.id}`);
  
  // Join project rooms
  socket.on('join-project', (projectId: string) => {
    socket.join(`project-${projectId}`);
    console.log(`User ${socket.data.userId} joined project ${projectId}`);
  });
  
  // Leave project rooms
  socket.on('leave-project', (projectId: string) => {
    socket.leave(`project-${projectId}`);
    console.log(`User ${socket.data.userId} left project ${projectId}`);
  });
  
  // Handle issue updates
  socket.on('issue-updated', (data: { issueId: string, projectId: string, changes: any }) => {
    socket.to(`project-${data.projectId}`).emit('issue-updated', data);
  });
  
  // Handle issue created
  socket.on('issue-created', (data: { issue: any, projectId: string }) => {
    socket.to(`project-${data.projectId}`).emit('issue-created', data);
  });
  
  // Handle issue deleted
  socket.on('issue-deleted', (data: { issueId: string, projectId: string }) => {
    socket.to(`project-${data.projectId}`).emit('issue-deleted', data);
  });
  
  // Handle comment added
  socket.on('comment-added', (data: { issueId: string, projectId: string, comment: any }) => {
    socket.to(`project-${data.projectId}`).emit('comment-added', data);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User ${socket.data.userId} disconnected`);
    connectedUsers.delete(socket.id);
  });
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    server.listen(PORT, () => {
      console.log(`JIRA Clone API server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

export { io };
