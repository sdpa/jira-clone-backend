import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { ProjectSettings, IssueType, Priority, Status } from '../types';

// Project Schema for DynamoDB
const projectSchema = new dynamoose.Schema({
  id: {
    type: String,
    hashKey: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  key: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'keyIndex'
    }
  },
  owner: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'ownerIndex'
    }
  },
  members: {
    type: Array,
    schema: [String],
    default: []
  },
  settings: {
    type: Object,
    schema: {
      defaultAssignee: String,
      issueTypes: {
        type: Array,
        schema: [String],
        default: [IssueType.TASK, IssueType.BUG, IssueType.STORY]
      },
      priorities: {
        type: Array,
        schema: [String],
        default: [Priority.LOW, Priority.MEDIUM, Priority.HIGH]
      },
      statuses: {
        type: Array,
        schema: [String],
        default: [Status.TODO, Status.IN_PROGRESS, Status.DONE]
      }
    },
    default: {
      issueTypes: [IssueType.TASK, IssueType.BUG, IssueType.STORY],
      priorities: [Priority.LOW, Priority.MEDIUM, Priority.HIGH],
      statuses: [Status.TODO, Status.IN_PROGRESS, Status.DONE]
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  saveUnknown: false
});

// Project class
class ProjectClass extends Item {
  id!: string;
  name!: string;
  description?: string;
  key!: string;
  owner!: string;
  members!: string[];
  settings!: ProjectSettings;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  // Instance method to add member
  async addMember(userId: string): Promise<ProjectClass> {
    if (!this.members.includes(userId)) {
      this.members.push(userId);
    }
    await this.save();
    return this;
  }

  // Instance method to remove member
  async removeMember(userId: string): Promise<ProjectClass> {
    this.members = this.members.filter(member => member !== userId);
    await this.save();
    return this;
  }

  // Instance method to check if user is member
  isMember(userId: string): boolean {
    return this.owner === userId || this.members.includes(userId);
  }

  // toJSON method
  toJSON() {
    const obj: any = { ...this };
    obj._id = obj.id;
    delete obj.id;
    return obj;
  }
}

// Create model
export const Project = dynamoose.model<ProjectClass>('Project', projectSchema, {
  create: process.env.NODE_ENV === 'development',
  update: process.env.NODE_ENV === 'development'
});

// Static method to find projects by user
(Project as any).findByUser = async function(userId: string) {
  // Get projects where user is owner
  const ownedProjects = await Project.query('owner').eq(userId).using('ownerIndex').exec();
  
  // Get projects where user is a member (requires scan)
  const memberProjects = await Project.scan('members').contains(userId).and().where('isActive').eq(true).exec();
  
  // Combine and deduplicate
  const projectMap = new Map();
  [...ownedProjects, ...memberProjects].forEach(p => projectMap.set(p.id, p));
  
  return Array.from(projectMap.values());
};

// Static method to generate unique project key
(Project as any).generateUniqueKey = async function(name: string): Promise<string> {
  const baseKey = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 10) || 'PROJ';
  
  let key = baseKey;
  let counter = 1;
  
  while (true) {
    const existing = await Project.query('key').eq(key).using('keyIndex').exec();
    if (existing.length === 0) break;
    key = `${baseKey}${counter}`;
    counter++;
  }
  
  return key;
};

// Static method to find by key
(Project as any).findByKey = async function(key: string) {
  const results = await Project.query('key').eq(key).using('keyIndex').exec();
  return results.length > 0 ? results[0] : null;
};
