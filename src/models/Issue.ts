import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { IssueType, Priority, Status, Attachment, Comment } from '../types';

// Issue Schema for DynamoDB
const issueSchema = new dynamoose.Schema({
  id: {
    type: String,
    hashKey: true
  },
  projectId: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'projectIdIndex'
    }
  },
  key: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'keyIndex'
    }
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  type: {
    type: String,
    enum: Object.values(IssueType),
    default: IssueType.TASK
  },
  priority: {
    type: String,
    enum: Object.values(Priority),
    default: Priority.MEDIUM
  },
  status: {
    type: String,
    enum: Object.values(Status),
    default: Status.TODO,
    index: {
      type: 'global',
      name: 'statusIndex'
    }
  },
  assignee: {
    type: String,
    index: {
      type: 'global',
      name: 'assigneeIndex'
    }
  },
  reporter: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'reporterIndex'
    }
  },
  labels: {
    type: Array,
    schema: [String],
    default: []
  },
  components: {
    type: Array,
    schema: [String],
    default: []
  },
  fixVersion: {
    type: String
  },
  dueDate: {
    type: Date
  },
  estimatedHours: {
    type: Number
  },
  loggedHours: {
    type: Number,
    default: 0
  },
  attachments: {
    type: Array,
    schema: [Object],
    default: []
  },
  comments: {
    type: Array,
    schema: [Object],
    default: []
  },
  watchers: {
    type: Array,
    schema: [String],
    default: []
  }
}, {
  timestamps: true,
  saveUnknown: false
});

// Issue class
class IssueClass extends Item {
  id!: string;
  projectId!: string;
  key!: string;
  title!: string;
  description?: string;
  type!: IssueType;
  priority!: Priority;
  status!: Status;
  assignee?: string;
  reporter!: string;
  labels!: string[];
  components!: string[];
  fixVersion?: string;
  dueDate?: Date;
  estimatedHours?: number;
  loggedHours!: number;
  attachments!: Attachment[];
  comments!: Comment[];
  watchers!: string[];
  createdAt!: Date;
  updatedAt!: Date;

  // Instance method to add comment
  async addComment(authorId: string, content: string, attachments: Attachment[] = []): Promise<IssueClass> {
    const comment: Comment = {
      _id: `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      author: authorId,
      content,
      attachments,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.comments.push(comment);
    await this.save();
    return this;
  }

  // Instance method to add watcher
  async addWatcher(userId: string): Promise<IssueClass> {
    if (!this.watchers.includes(userId)) {
      this.watchers.push(userId);
    }
    await this.save();
    return this;
  }

  // Instance method to remove watcher
  async removeWatcher(userId: string): Promise<IssueClass> {
    this.watchers = this.watchers.filter(watcher => watcher !== userId);
    await this.save();
    return this;
  }

  // Instance method to log time
  async logTime(hours: number): Promise<IssueClass> {
    this.loggedHours += hours;
    await this.save();
    return this;
  }

  // Instance method to update status
  async updateStatus(status: Status): Promise<IssueClass> {
    this.status = status;
    await this.save();
    return this;
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
export const Issue = dynamoose.model<IssueClass>('Issue', issueSchema, {
  create: process.env.NODE_ENV === 'development',
  update: process.env.NODE_ENV === 'development'
});

// Static method to generate unique issue key
(Issue as any).generateUniqueKey = async function(projectKey: string): Promise<string> {
  // Query all issues for this project
  const projectIssues = await Issue.scan('key').beginsWith(projectKey).exec();
  
  let maxNumber = 0;
  projectIssues.forEach((issue: IssueClass) => {
    const parts = issue.key.split('-');
    if (parts.length === 2) {
      const num = parseInt(parts[1]);
      if (num > maxNumber) maxNumber = num;
    }
  });
  
  return `${projectKey}-${maxNumber + 1}`;
};

// Static method to find issues by project
(Issue as any).findByProject = async function(projectId: string) {
  return await Issue.query('projectId').eq(projectId).using('projectIdIndex').exec();
};

// Static method to find issues by assignee
(Issue as any).findByAssignee = async function(assigneeId: string) {
  return await Issue.query('assignee').eq(assigneeId).using('assigneeIndex').exec();
};

// Static method to find by key
(Issue as any).findByKey = async function(key: string) {
  const results = await Issue.query('key').eq(key).using('keyIndex').exec();
  return results.length > 0 ? results[0] : null;
};

// Static method to get issue statistics
(Issue as any).getStatistics = async function(projectId: string) {
  const issues = await Issue.query('projectId').eq(projectId).using('projectIdIndex').exec();
  
  const stats = {
    total: issues.length,
    byStatus: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    totalEstimatedHours: 0,
    totalLoggedHours: 0
  };
  
  issues.forEach((issue: IssueClass) => {
    stats.byStatus[issue.status] = (stats.byStatus[issue.status] || 0) + 1;
    stats.byPriority[issue.priority] = (stats.byPriority[issue.priority] || 0) + 1;
    stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
    stats.totalEstimatedHours += issue.estimatedHours || 0;
    stats.totalLoggedHours += issue.loggedHours || 0;
  });
  
  return stats;
};
