import { ProjectRepository } from '../ProjectRepository';
import { Project } from '../../models/Project';

jest.mock('../../models/Project');

describe('ProjectRepository', () => {
    let projectRepo: ProjectRepository;

    beforeEach(() => {
        projectRepo = new ProjectRepository();
        jest.clearAllMocks();
    });

    describe('findByKey', () => {
        it('should find project by key', async () => {
            const mockProject = {
                _id: 'project-1',
                key: 'TEST',
                name: 'Test Project'
            };

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockProject])
            };

            (Project.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await projectRepo.findByKey('TEST');

            expect(Project.query).toHaveBeenCalledWith('key');
            expect(mockQuery.eq).toHaveBeenCalledWith('TEST');
            expect(mockQuery.using).toHaveBeenCalledWith('keyIndex');
            expect(result).toEqual(mockProject);
        });

        it('should return undefined if project not found', async () => {
            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([])
            };

            (Project.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await projectRepo.findByKey('NONEXISTENT');

            expect(result).toBeUndefined();
        });
    });

    describe('findByUser', () => {
        it('should find projects where user is a member', async () => {
            const mockProjects = [
                { _id: 'project-1', members: ['user-1'], isActive: true },
                { _id: 'project-2', members: ['user-1'], isActive: true }
            ];

            const mockScan = {
                contains: jest.fn().mockReturnThis(),
                and: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockProjects)
            };

            (Project.scan as jest.Mock) = jest.fn().mockReturnValue(mockScan);

            const result = await projectRepo.findByUser('user-1');

            expect(Project.scan).toHaveBeenCalledWith('members');
            expect(mockScan.contains).toHaveBeenCalledWith('user-1');
            expect(result).toEqual(mockProjects);
        });
    });

    describe('findByOwner', () => {
        it('should find projects by owner', async () => {
            const mockProjects = [
                { _id: 'project-1', owner: 'user-1' },
                { _id: 'project-2', owner: 'user-1' }
            ];

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockProjects)
            };

            (Project.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await projectRepo.findByOwner('user-1');

            expect(Project.query).toHaveBeenCalledWith('owner');
            expect(mockQuery.eq).toHaveBeenCalledWith('user-1');
            expect(mockQuery.using).toHaveBeenCalledWith('ownerIndex');
            expect(result).toEqual(mockProjects);
        });
    });

    describe('CRUD operations', () => {
        it('should find project by id', async () => {
            const mockProject = { _id: 'project-1', name: 'Test Project' };
            (Project.get as jest.Mock) = jest.fn().mockResolvedValue(mockProject);

            const result = await projectRepo.findById('project-1');

            expect(Project.get).toHaveBeenCalledWith('project-1');
            expect(result).toEqual(mockProject);
        });

        it('should create a new project', async () => {
            const projectData = {
                name: 'New Project',
                key: 'NEW',
                owner: 'user-1',
                members: ['user-1']
            };
            const mockProject = { _id: 'project-2', ...projectData };

            (Project.create as jest.Mock) = jest.fn().mockResolvedValue(mockProject);

            const result = await projectRepo.create(projectData as any);

            expect(Project.create).toHaveBeenCalledWith(projectData);
            expect(result).toEqual(mockProject);
        });

        it('should update a project', async () => {
            const mockProject = {
                _id: 'project-1',
                name: 'Old Name',
                save: jest.fn().mockResolvedValue(true)
            };

            (Project.get as jest.Mock) = jest.fn().mockResolvedValue(mockProject);

            const result = await projectRepo.update('project-1', { name: 'New Name' } as any);

            expect(mockProject.name).toBe('New Name');
            expect(mockProject.save).toHaveBeenCalled();
            expect(result).toEqual(mockProject);
        });

        it('should delete a project', async () => {
            (Project.delete as jest.Mock) = jest.fn().mockResolvedValue(true);

            await projectRepo.delete('project-1');

            expect(Project.delete).toHaveBeenCalledWith('project-1');
        });
    });
});
