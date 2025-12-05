import express from 'express';
import Joi from 'joi';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { authenticate, authorize, authorizeProjectMember } from '../middleware/auth';
import { ApiResponse, AuthenticatedRequest, UserRole, IssueType, Priority, Status } from '../types';
import { populateUser, populateUsers } from '../utils/populate';
import { IssueRepository } from '../repositories/IssueRepository';

const router = express.Router();
const projectRepo = new ProjectRepository();
const issueRepo = new IssueRepository();

// Validation schemas
const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(1000).optional(),
  key: Joi.string().min(2).max(10).uppercase().pattern(/^[A-Z]+$/).optional()
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  description: Joi.string().max(1000),
  settings: Joi.object({
    defaultAssignee: Joi.string().optional(),
    issueTypes: Joi.array().items(Joi.string().valid(...Object.values(IssueType))),
    priorities: Joi.array().items(Joi.string().valid(...Object.values(Priority))),
    statuses: Joi.array().items(Joi.string().valid(...Object.values(Status)))
  })
});

const addMemberSchema = Joi.object({
  userId: Joi.string().required()
});

// Get all projects for user
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await projectRepo.findByUser(req.user!._id.toString());

    // Populate owner and members manually
    const populatedProjects = await Promise.all(projects.map(async (project: any) => {
      const owner = await populateUser(project.owner);
      const members = await populateUsers(project.members);
      return {
        ...project.toJSON(),
        owner,
        members
      };
    }));

    return res.json({
      success: true,
      data: { projects: populatedProjects }
    } as ApiResponse);
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Get project by ID
router.get('/:id', authenticate, authorizeProjectMember((req) => req.params.id), async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectRepo.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      } as ApiResponse);
    }

    // Populate owner and members manually
    const owner = await populateUser(project.owner);
    const members = await populateUsers(project.members);

    return res.json({
      success: true,
      data: {
        project: {
          ...project.toJSON(),
          owner,
          members
        }
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Create new project
router.post('/', authenticate, authorize(UserRole.ADMIN, UserRole.PROJECT_MANAGER), async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = createProjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { name, description, key } = value;

    // Generate unique project key if not provided
    // Note: Moving this logic to repository or service would be better, but keeping here for now
    let projectKey = key;
    if (!projectKey) {
      // Simple generation logic for now, ideally should be in a service
      projectKey = name.substring(0, 3).toUpperCase();
      let counter = 1;
      while (await projectRepo.findByKey(projectKey)) {
        projectKey = `${name.substring(0, 3).toUpperCase()}${counter}`;
        counter++;
      }
    }

    // Check if key already exists
    const existingProject = await projectRepo.findByKey(projectKey);
    if (existingProject) {
      return res.status(400).json({
        success: false,
        error: 'Project key already exists'
      } as ApiResponse);
    }

    const project = await projectRepo.create({
      name,
      description,
      key: projectKey,
      owner: req.user!._id,
      members: [req.user!._id] // Owner is automatically added to members
    });

    // Populate owner and members manually
    const owner = await populateUser(project.owner);
    const members = await populateUsers(project.members);

    return res.status(201).json({
      success: true,
      data: {
        project: {
          ...project.toJSON(),
          owner,
          members
        }
      },
      message: 'Project created successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Update project
router.put('/:id', authenticate, authorizeProjectMember((req) => req.params.id), async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const project = await projectRepo.update(
      req.params.id,
      { ...value, updatedAt: new Date() }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      } as ApiResponse);
    }

    // Populate owner and members manually
    const owner = await populateUser(project.owner);
    const members = await populateUsers(project.members);

    return res.json({
      success: true,
      data: {
        project: {
          ...project.toJSON(),
          owner,
          members
        }
      },
      message: 'Project updated successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Delete project
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectRepo.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      } as ApiResponse);
    }

    // Soft delete by setting isActive to false
    project.isActive = false;
    await project.save();

    return res.json({
      success: true,
      message: 'Project deleted successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Add member to project
router.post('/:id/members', authenticate, authorizeProjectMember((req) => req.params.id), async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = addMemberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
    }

    const { userId } = value;
    const project = await projectRepo.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      } as ApiResponse);
    }

    // Check if user is already a member
    if (project.isMember(userId)) {
      return res.status(400).json({
        success: false,
        error: 'User is already a member of this project'
      } as ApiResponse);
    }

    await project.addMember(userId);

    // Populate owner and members manually
    const owner = await populateUser(project.owner);
    const members = await populateUsers(project.members);

    return res.json({
      success: true,
      data: {
        project: {
          ...project.toJSON(),
          owner,
          members
        }
      },
      message: 'Member added successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Add member error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Remove member from project
router.delete('/:id/members/:userId', authenticate, authorizeProjectMember((req) => req.params.id), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const project = await projectRepo.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      } as ApiResponse);
    }

    // Prevent removing the owner
    if (project.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove project owner'
      } as ApiResponse);
    }

    // Check if user is a member
    if (!project.isMember(userId)) {
      return res.status(400).json({
        success: false,
        error: 'User is not a member of this project'
      } as ApiResponse);
    }

    await project.removeMember(userId);

    // Populate owner and members manually
    const owner = await populateUser(project.owner);
    const members = await populateUsers(project.members);

    return res.json({
      success: true,
      data: {
        project: {
          ...project.toJSON(),
          owner,
          members
        }
      },
      message: 'Member removed successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

// Get project statistics
router.get('/:id/stats', authenticate, authorizeProjectMember((req) => req.params.id), async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await issueRepo.getStatistics(req.params.id);

    return res.json({
      success: true,
      data: { stats }
    } as ApiResponse);
  } catch (error) {
    console.error('Get project stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
});

export default router;
