import { IssueRepository } from '../IssueRepository';
import { Issue } from '../../models/Issue';

jest.mock('../../models/Issue');

describe('IssueRepository', () => {
    let issueRepo: IssueRepository;

    beforeEach(() => {
        issueRepo = new IssueRepository();
        jest.clearAllMocks();
    });

    describe('findByKey', () => {
        it('should find issue by key', async () => {
            const mockIssue = {
                _id: 'issue-1',
                key: 'TEST-1',
                title: 'Test Issue'
            };

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockIssue])
            };

            (Issue.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await issueRepo.findByKey('TEST-1');

            expect(Issue.query).toHaveBeenCalledWith('key');
            expect(mockQuery.eq).toHaveBeenCalledWith('TEST-1');
            expect(mockQuery.using).toHaveBeenCalledWith('keyIndex');
            expect(result).toEqual(mockIssue);
        });
    });

    describe('findByProject', () => {
        it('should find issues by project', async () => {
            const mockIssues = [
                { _id: 'issue-1', projectId: 'project-1' },
                { _id: 'issue-2', projectId: 'project-1' }
            ];

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockIssues)
            };

            (Issue.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await issueRepo.findByProject('project-1');

            expect(Issue.query).toHaveBeenCalledWith('projectId');
            expect(mockQuery.eq).toHaveBeenCalledWith('project-1');
            expect(mockQuery.using).toHaveBeenCalledWith('projectIdIndex');
            expect(result).toEqual(mockIssues);
        });
    });

    describe('findByAssignee', () => {
        it('should find issues by assignee', async () => {
            const mockIssues = [
                { _id: 'issue-1', assignee: 'user-1' },
                { _id: 'issue-2', assignee: 'user-1' }
            ];

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockIssues)
            };

            (Issue.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await issueRepo.findByAssignee('user-1');

            expect(Issue.query).toHaveBeenCalledWith('assignee');
            expect(mockQuery.eq).toHaveBeenCalledWith('user-1');
            expect(mockQuery.using).toHaveBeenCalledWith('assigneeIndex');
            expect(result).toEqual(mockIssues);
        });
    });

    describe('findByReporter', () => {
        it('should find issues by reporter', async () => {
            const mockIssues = [
                { _id: 'issue-1', reporter: 'user-1' },
                { _id: 'issue-2', reporter: 'user-1' }
            ];

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockIssues)
            };

            (Issue.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await issueRepo.findByReporter('user-1');

            expect(Issue.query).toHaveBeenCalledWith('reporter');
            expect(mockQuery.eq).toHaveBeenCalledWith('user-1');
            expect(mockQuery.using).toHaveBeenCalledWith('reporterIndex');
            expect(result).toEqual(mockIssues);
        });
    });

    describe('CRUD operations', () => {
        it('should find issue by id', async () => {
            const mockIssue = { _id: 'issue-1', title: 'Test Issue' };
            (Issue.get as jest.Mock) = jest.fn().mockResolvedValue(mockIssue);

            const result = await issueRepo.findById('issue-1');

            expect(Issue.get).toHaveBeenCalledWith('issue-1');
            expect(result).toEqual(mockIssue);
        });

        it('should create a new issue', async () => {
            const issueData = {
                title: 'New Issue',
                projectId: 'project-1',
                reporter: 'user-1'
            };
            const mockIssue = { _id: 'issue-2', ...issueData };

            (Issue.create as jest.Mock) = jest.fn().mockResolvedValue(mockIssue);

            const result = await issueRepo.create(issueData as any);

            expect(Issue.create).toHaveBeenCalledWith(issueData);
            expect(result).toEqual(mockIssue);
        });

        it('should update an issue', async () => {
            const mockIssue = {
                _id: 'issue-1',
                title: 'Old Title',
                save: jest.fn().mockResolvedValue(true)
            };

            (Issue.get as jest.Mock) = jest.fn().mockResolvedValue(mockIssue);

            const result = await issueRepo.update('issue-1', { title: 'New Title' } as any);

            expect(mockIssue.title).toBe('New Title');
            expect(mockIssue.save).toHaveBeenCalled();
            expect(result).toEqual(mockIssue);
        });

        it('should delete an issue', async () => {
            (Issue.delete as jest.Mock) = jest.fn().mockResolvedValue(true);

            await issueRepo.delete('issue-1');

            expect(Issue.delete).toHaveBeenCalledWith('issue-1');
        });
    });
});
