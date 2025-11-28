import express from 'express';
import Joi from 'joi';
import { Issue } from '../models/Issue';
import { Project } from '../models/Project';
import { authenticate, authorizeProjectMember } from '../middleware/auth';
import { ApiResponse, AuthenticatedRequest, IssueType, Priority, Status, IssueFilter, PaginationQuery } from '../types';

const router = express.Router();

// Validation schemas
const createIssueSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(10000).optional(),
  type: Joi.string().valid(...Object.values(IssueType)).default(IssueType.TASK),
  priority: Joi.string().valid(...Object.values(Priority)).default(Priority.MEDIUM),
  assignee: Joi.string().optional(),
  labels: Joi.array().items(Joi.string().max(50)).default([]),
  components: Joi.array().items(Joi.string().max(100)).default([]),
  fixVersion: Joi.string().max(50).optional(),
  dueDate: Joi.date().optional(),
  estimatedHours: Joi.number().min(0).optional()
});

const updateIssueSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().max(10000),
  type: Joi.string().valid(...Object.values(IssueType)),
  priority: Joi.string().valid(...Object.values(Priority)),
  status: Joi.string().valid(...Object.values(Status)),
  assignee: Joi.string().allow(null),
  labels: Joi.array().items(Joi.string().max(50)),
  components: Joi.array().items(Joi.string().max(100)),
  fixVersion: Joi.string().max(50).allow(null),
  dueDate: Joi.date().allow(null),
  estimatedHours: Joi.number().min(0).allow(null)
});

const addCommentSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required()
});

const logTimeSchema = Joi.object({
  hours: Joi.number().min(0).required(),
  description: Joi.string().max(500).optional()
});

// Get issues with filtering and pagination
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      projectId,
      assignee,
      reporter,
      status,
      priority,
      type,
      labels,
      components,
      search,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query as any;

    // Build filter object
    const filter: any = {};

    if (projectId) {
      // Check if user has access to this project
      const project = await Project.findById(projectId);
      if (!project || !project.isMember(req.user!._id.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this project'
        } as ApiResponse);
      }
      filter.projectId = projectId;
    }

    if (assignee) filter.assignee = assignee;
    if (reporter) filter.reporter = reporter;
    if (status) filter.status = { $in: Array.isArray(status) ? status : [status] };
    if (priority) filter.priority = { $in: Array.isArray(priority) ? priority : [priority] };
    if (type) filter.type = { $in: Array.isArray(type) ? type : [type] };
    if (labels) filter.labels = { $in: Array.isArray(labels) ? labels : [labels] };
    if (components) filter.components = { $in: Array.isArray(components) ? components : [components] };

    // Date filters
    if (createdAfter || createdBefore) {
      filter.createdAt = {};
      if (createdAfter) filter.createdAt.$gte = new Date(createdAfter);
      if (createdBefore) filter.createdAt.$lte = new Date(createdBefore);
    }

    if (updatedAfter || updatedBefore) {
      filter.updatedAt = {};
      if (updatedAfter) filter.updatedAt.$gte = new Date(updatedAfter);
      if (updatedBefore) filter.updatedAt.$lte = new Date(updatedBefore);
    }

    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { key: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate('assignee', 'firstName lastName email avatar')
        .populate('reporter', 'firstName lastName email avatar')
        .populate('projectId', 'name key')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Issue.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / parseInt(limit));

    return res.json({
      success: true,
      data: { issues },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Get issues error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Get issue by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('assignee', 'firstName lastName email avatar')
      .populate('reporter', 'firstName lastName email avatar')
      .populate('projectId', 'name key')
      .populate('comments.author', 'firstName lastName email avatar')
      .populate('watchers', 'firstName lastName email avatar');

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    // Check if user has access to this project
    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: { issue }
    } as ApiResponse);
  } catch (error) {
    console.error('Get issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Create new issue
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = createIssueSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { projectId, ...issueData } = value;

    // Check if project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      } as ApiResponse);
    }

    if (!project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this project'
      } as ApiResponse);
    }

    // Generate unique issue key
    const key = await Issue.generateUniqueKey(project.key);

    const issue = new Issue({
      ...issueData,
      projectId,
      key,
      reporter: req.user!._id,
      watchers: [req.user!._id] // Reporter is automatically added to watchers
    });

    await issue.save();

    const populatedIssue = await Issue.findById(issue._id)
      .populate('assignee', 'firstName lastName email avatar')
      .populate('reporter', 'firstName lastName email avatar')
      .populate('projectId', 'name key');

    return res.status(201).json({
      success: true,
      data: { issue: populatedIssue },
      message: 'Issue created successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Create issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Update issue
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = updateIssueSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    // Check if user has access to this project
    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    const updatedIssue = await Issue.findByIdAndUpdate(
      req.params.id,
      { ...value, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('assignee', 'firstName lastName email avatar')
      .populate('reporter', 'firstName lastName email avatar')
      .populate('projectId', 'name key');

    return res.json({
      success: true,
      data: { issue: updatedIssue },
      message: 'Issue updated successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Update issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Delete issue
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    // Check if user has access to this project
    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    await Issue.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Issue deleted successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Delete issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Add comment to issue
router.post('/:id/comments', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = addCommentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { content } = value;
    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    // Check if user has access to this project
    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    await issue.addComment(req.user!._id.toString(), content);

    const updatedIssue = await Issue.findById(issue._id)
      .populate('comments.author', 'firstName lastName email avatar');

    return res.json({
      success: true,
      data: { issue: updatedIssue },
      message: 'Comment added successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Log time to issue
router.post('/:id/time', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = logTimeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { hours, description } = value;
    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    // Check if user has access to this project
    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    await issue.logTime(hours);

    // Add a comment about the time log
    if (description) {
      await issue.addComment(
        req.user!._id.toString(),
        `Logged ${hours} hours: ${description}`
      );
    }

    const updatedIssue = await Issue.findById(issue._id)
      .populate('assignee', 'firstName lastName email avatar')
      .populate('reporter', 'firstName lastName email avatar');

    return res.json({
      success: true,
      data: { issue: updatedIssue },
      message: 'Time logged successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Log time error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Add watcher to issue
router.post('/:id/watchers', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    // Check if user has access to this project
    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    await issue.addWatcher(req.user!._id.toString());

    return res.json({
      success: true,
      message: 'Added to watchers successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Add watcher error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Remove watcher from issue
router.delete('/:id/watchers', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    // Check if user has access to this project
    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    await issue.removeWatcher(req.user!._id.toString());

    return res.json({
      success: true,
      message: 'Removed from watchers successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Remove watcher error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

export default router;
