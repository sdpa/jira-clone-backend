import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types';

// User Schema for DynamoDB
const userSchema = new dynamoose.Schema({
  id: {
    type: String,
    hashKey: true
  },
  email: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'emailIndex'
    }
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.VIEWER
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true,
  saveUnknown: false
});

// User class extending Item
class UserClass extends Item {
  id!: string;
  email!: string;
  password!: string;
  firstName!: string;
  lastName!: string;
  avatar?: string;
  role!: UserRole;
  isActive!: boolean;
  lastLogin?: Date;
  createdAt!: Date;
  updatedAt!: Date;

  // Instance method to check password
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Instance method to update last login
  async updateLastLogin(): Promise<UserClass> {
    this.lastLogin = new Date();
    await this.save();
    return this;
  }

  // toJSON method for serialization
  toJSON() {
    const obj: any = { ...this };
    delete obj.password;
    // Rename id to _id for frontend compatibility
    obj._id = obj.id;
    delete obj.id;
    return obj;
  }
}

// Create model
export const User = dynamoose.model<UserClass>('User', userSchema, {
  create: process.env.NODE_ENV === 'development',
  update: process.env.NODE_ENV === 'development',
  waitForActive: {
    enabled: true,
    check: {
      timeout: 180000,
      frequency: 1000
    }
  }
});

// Pre-save hook to hash password
User.methods.set('init', async function (this: UserClass) {
  // Hash password before saving if modified
  const original = await User.get(this.id).catch(() => null);
  if (!original || this.password !== original.password) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Static method to find active users
(User as any).findActiveUsers = async function () {
  return await User.scan('isActive').eq(true).exec();
};

// Static method to find users by role
(User as any).findByRole = async function (role: UserRole) {
  return await User.scan('role').eq(role).and().where('isActive').eq(true).exec();
};

// Static method to find by email
(User as any).findByEmail = async function (email: string) {
  const results = await User.query('email').eq(email.toLowerCase()).using('emailIndex').exec();
  return results.length > 0 ? results[0] : null;
};
