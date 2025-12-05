import { BaseRepository } from './BaseRepository';
import { Comment } from '../models/Comment';

type CommentType = InstanceType<typeof Comment>;

export class CommentRepository extends BaseRepository<CommentType> {
    constructor() {
        super(Comment);
    }

    async findByIssue(issueId: string): Promise<CommentType[]> {
        return await this.model.query('issueId').eq(issueId).using('issueIdIndex').exec();
    }

    async findByAuthor(authorId: string): Promise<CommentType[]> {
        return await this.model.query('author').eq(authorId).using('authorIndex').exec();
    }
}
