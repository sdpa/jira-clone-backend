import express from 'express';
import Joi from 'joi';
import { Comment } from '../models/Comment';
import { Issue } from '../models/Issue';
import { Project } from '../models/Project';
import { authenticate } from '../middleware/auth';
import { ApiResponse, AuthenticatedRequest, PaginationQuery } from '../types';

const router = express.Router();

// Validation schemas
const createCommentSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required()
});

const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required()
});

// Get comments for an issue with pagination
router.get('/issues/:issueId/comments', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { issueId } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'asc'
    } = req.query as any;

    // Check if issue exists and user has access
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const commentsQuery = Comment.findByIssue(issueId);
    const [comments, total] = await Promise.all([
      commentsQuery.sort(sort).skip(skip).limit(parseInt(limit)),
      Comment.countDocuments({ issueId })
    ]);

    const pages = Math.ceil(total / parseInt(limit));

    return res.json({
      success: true,
      data: { comments },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Get a specific comment
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate('author', 'firstName lastName email avatar')
      .populate('issueId', 'title key projectId');

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      } as ApiResponse);
    }

    // Check if user has access to the issue
    const issue = await Issue.findById(comment.issueId);
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this comment'
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: { comment }
    } as ApiResponse);
  } catch (error) {
    console.error('Get comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Create a new comment
router.post('/issues/:issueId/comments', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = createCommentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { issueId } = req.params;
    const { content } = value;

    // Check if issue exists and user has access
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    // Create comment
    const comment = new Comment({
      issueId,
      author: req.user!._id,
      content
    });

    await comment.save();

    // Also add comment to issue's embedded comments array for backward compatibility
    await issue.addComment(req.user!._id.toString(), content);

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar');

    return res.status(201).json({
      success: true,
      data: { comment: populatedComment },
      message: 'Comment created successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Update a comment
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = updateCommentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { content } = value;
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      } as ApiResponse);
    }

    // Check if user is the author of the comment
    if (comment.author.toString() !== req.user!._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own comments'
      } as ApiResponse);
    }

    // Update comment
    await comment.updateContent(content);

    const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar');

    return res.json({
      success: true,
      data: { comment: updatedComment },
      message: 'Comment updated successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Update comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Delete a comment
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      } as ApiResponse);
    }

    // Check if user is the author of the comment or has admin access
    const isAuthor = comment.author.toString() === req.user!._id.toString();
    const isAdmin = req.user!.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own comments'
      } as ApiResponse);
    }

    await Comment.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Comment deleted successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Get comment statistics for an issue
router.get('/issues/:issueId/comments/stats', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { issueId } = req.params;

    // Check if issue exists and user has access
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      } as ApiResponse);
    }

    const project = await Project.findById(issue.projectId);
    if (!project || !project.isMember(req.user!._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this issue'
      } as ApiResponse);
    }

    const stats = await Comment.getCommentStats(issueId);

    return res.json({
      success: true,
      data: { stats }
    } as ApiResponse);
  } catch (error) {
    console.error('Get comment stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Get comments by author
router.get('/author/:authorId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { authorId } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query as any;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const commentsQuery = Comment.findByAuthor(authorId);
    const [comments, total] = await Promise.all([
      commentsQuery.sort(sort).skip(skip).limit(parseInt(limit)),
      Comment.countDocuments({ author: authorId })
    ]);

    const pages = Math.ceil(total / parseInt(limit));

    return res.json({
      success: true,
      data: { comments },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Get comments by author error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

export default router;
