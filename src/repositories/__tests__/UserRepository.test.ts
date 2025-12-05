import { UserRepository } from '../UserRepository';
import { User } from '../../models/User';
import { UserRole } from '../../types';

// Mock the User model
jest.mock('../../models/User');

describe('UserRepository', () => {
    let userRepo: UserRepository;

    beforeEach(() => {
        userRepo = new UserRepository();
        jest.clearAllMocks();
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
            const mockUser = {
                _id: 'user-1',
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
                role: UserRole.DEVELOPER
            };

            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockUser])
            };

            (User.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await userRepo.findByEmail('test@example.com');

            expect(User.query).toHaveBeenCalledWith('email');
            expect(mockQuery.eq).toHaveBeenCalledWith('test@example.com');
            expect(mockQuery.using).toHaveBeenCalledWith('emailIndex');
            expect(result).toEqual(mockUser);
        });

        it('should return undefined if user not found', async () => {
            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                using: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([])
            };

            (User.query as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

            const result = await userRepo.findByEmail('nonexistent@example.com');

            expect(result).toBeUndefined();
        });
    });

    describe('findByRole', () => {
        it('should find users by role', async () => {
            const mockUsers = [
                { _id: 'user-1', role: UserRole.ADMIN, isActive: true },
                { _id: 'user-2', role: UserRole.ADMIN, isActive: true }
            ];

            const mockScan = {
                eq: jest.fn().mockReturnThis(),
                and: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockUsers)
            };

            (User.scan as jest.Mock) = jest.fn().mockReturnValue(mockScan);

            const result = await userRepo.findByRole(UserRole.ADMIN);

            expect(User.scan).toHaveBeenCalledWith('role');
            expect(mockScan.eq).toHaveBeenCalledWith(UserRole.ADMIN);
            expect(result).toEqual(mockUsers);
        });
    });

    describe('findActiveUsers', () => {
        it('should find all active users', async () => {
            const mockUsers = [
                { _id: 'user-1', isActive: true },
                { _id: 'user-2', isActive: true }
            ];

            const mockScan = {
                eq: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockUsers)
            };

            (User.scan as jest.Mock) = jest.fn().mockReturnValue(mockScan);

            const result = await userRepo.findActiveUsers();

            expect(User.scan).toHaveBeenCalledWith('isActive');
            expect(mockScan.eq).toHaveBeenCalledWith(true);
            expect(result).toEqual(mockUsers);
        });
    });

    describe('CRUD operations', () => {
        it('should find user by id', async () => {
            const mockUser = { _id: 'user-1', email: 'test@example.com' };
            (User.get as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

            const result = await userRepo.findById('user-1');

            expect(User.get).toHaveBeenCalledWith('user-1');
            expect(result).toEqual(mockUser);
        });

        it('should create a new user', async () => {
            const userData = {
                email: 'new@example.com',
                password: 'hashed-password',
                firstName: 'New',
                lastName: 'User'
            };
            const mockUser = { _id: 'user-2', ...userData };

            (User.create as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

            const result = await userRepo.create(userData as any);

            expect(User.create).toHaveBeenCalledWith(userData);
            expect(result).toEqual(mockUser);
        });

        it('should update a user', async () => {
            const mockUser = {
                _id: 'user-1',
                firstName: 'Old',
                save: jest.fn().mockResolvedValue(true)
            };

            (User.get as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

            const result = await userRepo.update('user-1', { firstName: 'New' } as any);

            expect(mockUser.firstName).toBe('New');
            expect(mockUser.save).toHaveBeenCalled();
            expect(result).toEqual(mockUser);
        });

        it('should delete a user', async () => {
            (User.delete as jest.Mock) = jest.fn().mockResolvedValue(true);

            await userRepo.delete('user-1');

            expect(User.delete).toHaveBeenCalledWith('user-1');
        });
    });
});
