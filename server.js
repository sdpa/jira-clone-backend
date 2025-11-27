const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jira-clone';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, default: 'viewer' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Project Schema
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  key: { type: String, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Issue Schema
const issueSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  type: { type: String, default: 'task' },
  priority: { type: String, default: 'medium' },
  status: { type: String, default: 'todo' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  labels: [String],
  components: [String],
  dueDate: Date,
  estimatedHours: Number,
  loggedHours: { type: Number, default: 0 },
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    createdAt: { type: Date, default: Date.now }
  }],
  watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Issue = mongoose.model('Issue', issueSchema);

// Auth middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'JIRA Clone API is running',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName
    });
    
    await user.save();
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      success: true,
      data: { user: user.toJSON(), token }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      data: { user: user.toJSON(), token }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

// Project routes
app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    }).populate('owner members');
    
    res.json({
      success: true,
      data: { projects }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const { name, description, key } = req.body;
    
    const project = new Project({
      name,
      description,
      key: key || name.toUpperCase().replace(/\s+/g, '').substring(0, 10),
      owner: req.user._id,
      members: [req.user._id]
    });
    
    await project.save();
    
    const populatedProject = await Project.findById(project._id).populate('owner members');
    
    res.status(201).json({
      success: true,
      data: { project: populatedProject }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Issue routes
app.get('/api/issues', authenticate, async (req, res) => {
  try {
    const { projectId, status, assignee } = req.query;
    const filter = {};
    
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    if (assignee) filter.assignee = assignee;
    
    const issues = await Issue.find(filter)
      .populate('assignee reporter projectId')
      .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      data: { issues }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/issues', authenticate, async (req, res) => {
  try {
    const { projectId, title, description, type, priority, assignee } = req.body;
    
    // Get project to generate issue key
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Generate issue key
    const issueCount = await Issue.countDocuments({ projectId });
    const key = `${project.key}-${issueCount + 1}`;
    
    const issueData = {
      projectId,
      key,
      title,
      description,
      type: type || 'task',
      priority: priority || 'medium',
      reporter: req.user._id,
      watchers: [req.user._id]
    };

    // Only add assignee if it's not empty
    if (assignee && assignee.trim() !== '') {
      issueData.assignee = assignee;
    }

    const issue = new Issue(issueData);
    
    await issue.save();
    
    const populatedIssue = await Issue.findById(issue._id)
      .populate('assignee reporter projectId');
    
    res.status(201).json({
      success: true,
      data: { issue: populatedIssue }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/issues/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const issue = await Issue.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).populate('assignee reporter projectId');
    
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    
    res.json({
      success: true,
      data: { issue }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connect to MongoDB and start server
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`JIRA Clone API server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });
