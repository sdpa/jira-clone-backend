import { CommentRepository } from '../CommentRepository';
import { Comment } from '../../models/Comment';

jest.mock('../../models/Comment');

describe('CommentRepository', () => {
    let commentRepo: CommentRepository;

    beforeEach(() => {
        commentRepo = new CommentRepository();
        jest.clearAllMocks();
    });

    describe('findByIssue', () => {
        it('should find comments by issue', async () => {
            const mockComments = [
                { _id: 'comment-1', issueId: 'issue-1', content: 'Comment 1' },
                { _id: 'comment-2', issueId: 'issue-1', content: 'Comment 2' }
            ];

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockComments)
            };

            (Comment.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await commentRepo.findByIssue('issue-1');

            expect(Comment.query).toHaveBeenCalledWith('issueId');
            expect(mockQuery.eq).toHaveBeenCalledWith('issue-1');
            expect(mockQuery.using).toHaveBeenCalledWith('issueIdIndex');
            expect(result).toEqual(mockComments);
        });
    });

    describe('findByAuthor', () => {
        it('should find comments by author', async () => {
            const mockComments = [
                { _id: 'comment-1', author: 'user-1', content: 'Comment 1' },
                { _id: 'comment-2', author: 'user-1', content: 'Comment 2' }
            ];

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockComments)
            };

            (Comment.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await commentRepo.findByAuthor('user-1');

            expect(Comment.query).toHaveBeenCalledWith('author');
            expect(mockQuery.eq).toHaveBeenCalledWith('user-1');
            expect(mockQuery.using).toHaveBeenCalledWith('authorIndex');
            expect(result).toEqual(mockComments);
        });
    });

    describe('CRUD operations', () => {
        it('should find comment by id', async () => {
            const mockComment = { _id: 'comment-1', content: 'Test Comment' };
            (Comment.get as jest.Mock) = jest.fn().mockResolvedValue(mockComment);

            const result = await commentRepo.findById('comment-1');

            expect(Comment.get).toHaveBeenCalledWith('comment-1');
            expect(result).toEqual(mockComment);
        });

        it('should create a new comment', async () => {
            const commentData = {
                issueId: 'issue-1',
                author: 'user-1',
                content: 'New Comment'
            };
            const mockComment = { _id: 'comment-2', ...commentData };

            (Comment.create as jest.Mock) = jest.fn().mockResolvedValue(mockComment);

            const result = await commentRepo.create(commentData as any);

            expect(Comment.create).toHaveBeenCalledWith(commentData);
            expect(result).toEqual(mockComment);
        });

        it('should update a comment', async () => {
            const mockComment = {
                _id: 'comment-1',
                content: 'Old Content',
                save: jest.fn().mockResolvedValue(true)
            };

            (Comment.get as jest.Mock) = jest.fn().mockResolvedValue(mockComment);

            const result = await commentRepo.update('comment-1', { content: 'New Content' } as any);

            expect(mockComment.content).toBe('New Content');
            expect(mockComment.save).toHaveBeenCalled();
            expect(result).toEqual(mockComment);
        });

        it('should delete a comment', async () => {
            (Comment.delete as jest.Mock) = jest.fn().mockResolvedValue(true);

            await commentRepo.delete('comment-1');

            expect(Comment.delete).toHaveBeenCalledWith('comment-1');
        });
    });
});
