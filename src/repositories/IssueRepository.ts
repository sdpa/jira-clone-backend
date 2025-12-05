import { BaseRepository } from './BaseRepository';
import { Issue } from '../models/Issue';

type IssueType = InstanceType<typeof Issue>;

export class IssueRepository extends BaseRepository<IssueType> {
    constructor() {
        super(Issue);
    }

    async findByKey(key: string): Promise<IssueType | undefined> {
        const results = await this.model.query('key').eq(key).using('keyIndex').exec();
        return results.length > 0 ? results[0] : undefined;
    }

    async findByProject(projectId: string): Promise<IssueType[]> {
        return await this.model.query('projectId').eq(projectId).using('projectIdIndex').exec();
    }

    async findByAssignee(assigneeId: string): Promise<IssueType[]> {
        return await this.model.query('assignee').eq(assigneeId).using('assigneeIndex').exec();
    }

    async findByReporter(reporterId: string): Promise<IssueType[]> {
        return await this.model.query('reporter').eq(reporterId).using('reporterIndex').exec();
    }

    async getStatistics(projectId: string): Promise<any> {
        // This logic was previously in the model static method
        return await (Issue as any).getStatistics(projectId);
    }
}
