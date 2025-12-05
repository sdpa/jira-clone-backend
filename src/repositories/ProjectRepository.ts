import { BaseRepository } from './BaseRepository';
import { Project } from '../models/Project';

type ProjectType = InstanceType<typeof Project>;

export class ProjectRepository extends BaseRepository<ProjectType> {
    constructor() {
        super(Project);
    }

    async findByKey(key: string): Promise<ProjectType | undefined> {
        const results = await this.model.query('key').eq(key).using('keyIndex').exec();
        return results.length > 0 ? results[0] : undefined;
    }

    async findByUser(userId: string): Promise<ProjectType[]> {
        // This is a scan because members is an array, which is hard to query efficiently in DynamoDB without complex indexing
        // For a production app with many projects, this would need a better data model (e.g. UserProject mapping table)
        return await this.model.scan('members').contains(userId).and().where('isActive').eq(true).exec();
    }

    async findByOwner(ownerId: string): Promise<ProjectType[]> {
        return await this.model.query('owner').eq(ownerId).using('ownerIndex').exec();
    }
}
