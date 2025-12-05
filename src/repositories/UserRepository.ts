import { BaseRepository } from './BaseRepository';
import { User } from '../models/User';
import { UserRole } from '../types';

// Define the User type based on the model
type UserType = InstanceType<typeof User>;

export class UserRepository extends BaseRepository<UserType> {
    constructor() {
        super(User);
    }

    async findByEmail(email: string): Promise<UserType | undefined> {
        const results = await this.model.query('email').eq(email.toLowerCase()).using('emailIndex').exec();
        return results.length > 0 ? results[0] : undefined;
    }

    async findByRole(role: UserRole): Promise<UserType[]> {
        return await this.model.scan('role').eq(role).and().where('isActive').eq(true).exec();
    }

    async findActiveUsers(): Promise<UserType[]> {
        return await this.model.scan('isActive').eq(true).exec();
    }
}
