import jwt from 'jsonwebtoken';
import { UserRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Factory function to create test users
export const createTestUser = (overrides = {}) => {
    return {
        _id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.DEVELOPER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON: function () {
            const { ...rest } = this;
            return rest;
        },
        ...overrides
    };
};

// Factory function to create test projects
export const createTestProject = (overrides = {}) => {
    return {
        _id: 'test-project-id',
        name: 'Test Project',
        key: 'TEST',
        description: 'Test project description',
        owner: 'test-user-id',
        members: ['test-user-id'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        isMember: jest.fn().mockReturnValue(true),
        addMember: jest.fn(),
        removeMember: jest.fn(),
        toJSON: function () {
            const { isMember, addMember, removeMember, ...rest } = this;
            return rest;
        },
        ...overrides
    };
};

// Factory function to create test issues
export const createTestIssue = (overrides = {}) => {
    return {
        _id: 'test-issue-id',
        key: 'TEST-1',
        title: 'Test Issue',
        description: 'Test issue description',
        type: 'task',
        priority: 'medium',
        status: 'todo',
        projectId: 'test-project-id',
        reporter: 'test-user-id',
        assignee: 'test-user-id',
        watchers: ['test-user-id'],
        labels: [],
        components: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        addComment: jest.fn(),
        addWatcher: jest.fn(),
        removeWatcher: jest.fn(),
        logTime: jest.fn(),
        toJSON: function () {
            const { addComment, addWatcher, removeWatcher, logTime, ...rest } = this;
            return rest;
        },
        ...overrides
    };
};

// Factory function to create test comments
export const createTestComment = (overrides = {}) => {
    return {
        _id: 'test-comment-id',
        issueId: 'test-issue-id',
        author: 'test-user-id',
        content: 'Test comment content',
        createdAt: new Date(),
        updatedAt: new Date(),
        updateContent: jest.fn(),
        toJSON: function () {
            const { updateContent, ...rest } = this;
            return rest;
        },
        ...overrides
    };
};

// Generate JWT token for testing
export const generateTestToken = (user: any) => {
    return jwt.sign(
        {
            _id: user._id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

// Mock Express request
export const mockRequest = (overrides = {}) => {
    return {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: null,
        ...overrides
    };
};

// Mock Express response
export const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};

// Mock Express next function
export const mockNext = () => jest.fn();
