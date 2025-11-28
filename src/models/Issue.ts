import mongoose, { Schema, Document } from 'mongoose';
import { IIssueModel, IssueType, Priority, Status, Attachment, Comment } from '../types';

interface IIssueDocument extends Document {
  projectId: string;
  key: string;
  title: string;
  description?: string;
  type: IssueType;
  priority: Priority;
  status: Status;
  assignee?: string;
  reporter: string;
  labels: string[];
  components: string[];
  fixVersion?: string;
  dueDate?: Date;
  estimatedHours?: number;
  loggedHours: number;
  attachments: Attachment[];
  comments: Comment[];
  watchers: string[];
  createdAt: Date;
  updatedAt: Date;
  addComment(authorId: string, content: string, attachments?: Attachment[]): Promise<IIssueDocument>;
  addWatcher(userId: string): Promise<IIssueDocument>;
  removeWatcher(userId: string): Promise<IIssueDocument>;
  logTime(hours: number): Promise<IIssueDocument>;
  updateStatus(status: Status): Promise<IIssueDocument>;
}

const attachmentSchema = new Schema<Attachment>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  uploadedBy: { type: String, required: true, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const commentSchema = new Schema<Comment>({
  author: { type: String, required: true, ref: 'User' },
  content: { type: String, required: true, maxlength: 10000 },
  attachments: [attachmentSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: true });

const issueSchema = new Schema<IIssueDocument>({
  projectId: {
    type: String,
    required: true,
    ref: 'Project'
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  description: {
    type: String,
    trim: true,
    maxlength: 10000
  },
  type: {
    type: String,
    enum: Object.values(IssueType),
    required: true,
    default: IssueType.TASK
  },
  priority: {
    type: String,
    enum: Object.values(Priority),
    required: true,
    default: Priority.MEDIUM
  },
  status: {
    type: String,
    enum: Object.values(Status),
    required: true,
    default: Status.TODO
  },
  assignee: {
    type: String,
    ref: 'User',
    default: null
  },
  reporter: {
    type: String,
    required: true,
    ref: 'User'
  },
  labels: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  components: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  fixVersion: {
    type: String,
    trim: true,
    maxlength: 50
  },
  dueDate: {
    type: Date,
    default: null
  },
  estimatedHours: {
    type: Number,
    min: 0,
    default: null
  },
  loggedHours: {
    type: Number,
    min: 0,
    default: 0
  },
  attachments: [attachmentSchema],
  comments: [commentSchema],
  watchers: [{
    type: String,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Indexes
issueSchema.index({ projectId: 1 });
issueSchema.index({ key: 1 });
issueSchema.index({ assignee: 1 });
issueSchema.index({ reporter: 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ priority: 1 });
issueSchema.index({ type: 1 });
issueSchema.index({ labels: 1 });
issueSchema.index({ components: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ updatedAt: -1 });

// Compound indexes for common queries
issueSchema.index({ projectId: 1, status: 1 });
issueSchema.index({ projectId: 1, assignee: 1 });
issueSchema.index({ projectId: 1, type: 1 });

// Virtual for issue URL
issueSchema.virtual('url').get(function() {
  return `/issues/${this.key}`;
});

// Virtual for time remaining
issueSchema.virtual('timeRemaining').get(function() {
  if (!this.estimatedHours || !this.loggedHours) return null;
  return Math.max(0, this.estimatedHours - this.loggedHours);
});

// Virtual for progress percentage
issueSchema.virtual('progressPercentage').get(function() {
  if (!this.estimatedHours || this.estimatedHours === 0) return 0;
  return Math.min(100, (this.loggedHours / this.estimatedHours) * 100);
});

// Pre-save middleware to ensure reporter is in watchers
issueSchema.pre('save', function(next) {
  if (this.reporter && !this.watchers.includes(this.reporter)) {
    this.watchers.push(this.reporter);
  }
  next();
});

// Instance method to add comment (embedded)
issueSchema.methods.addComment = function(authorId: string, content: string, attachments: Attachment[] = []) {
  const comment: Comment = {
    _id: new mongoose.Types.ObjectId().toString(),
    author: authorId,
    content,
    attachments,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  this.comments.push(comment);
  return this.save();
};

// Instance method to get standalone comments
issueSchema.methods.getStandaloneComments = function() {
  const { Comment } = require('./Comment');
  return Comment.findByIssue(this._id.toString());
};

// Instance method to get comment count
issueSchema.methods.getCommentCount = function() {
  const { Comment } = require('./Comment');
  return Comment.countDocuments({ issueId: this._id.toString() });
};

// Instance method to add watcher
issueSchema.methods.addWatcher = function(userId: string) {
  if (!this.watchers.includes(userId)) {
    this.watchers.push(userId);
  }
  return this.save();
};

// Instance method to remove watcher
issueSchema.methods.removeWatcher = function(userId: string) {
  this.watchers = this.watchers.filter((watcher: string) => watcher.toString() !== userId);
  return this.save();
};

// Instance method to log time
issueSchema.methods.logTime = function(hours: number) {
  this.loggedHours += hours;
  return this.save();
};

// Instance method to update status
issueSchema.methods.updateStatus = function(status: Status) {
  this.status = status;
  return this.save();
};

// Static method to generate unique issue key
issueSchema.statics.generateUniqueKey = async function(projectKey: string): Promise<string> {
  const lastIssue = await this.findOne({ key: new RegExp(`^${projectKey}-`) })
    .sort({ key: -1 });
  
  let nextNumber = 1;
  if (lastIssue) {
    const lastNumber = parseInt(lastIssue.key.split('-')[1]);
    nextNumber = lastNumber + 1;
  }
  
  return `${projectKey}-${nextNumber}`;
};

// Static method to find issues by project
issueSchema.statics.findByProject = function(projectId: string) {
  return this.find({ projectId }).populate('assignee reporter');
};

// Static method to find issues by assignee
issueSchema.statics.findByAssignee = function(assigneeId: string) {
  return this.find({ assignee: assigneeId }).populate('projectId');
};

// Static method to get issue statistics
issueSchema.statics.getStatistics = async function(projectId: string) {
  const stats = await this.aggregate([
    { $match: { projectId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byStatus: { $push: '$status' },
        byPriority: { $push: '$priority' },
        byType: { $push: '$type' },
        totalEstimatedHours: { $sum: '$estimatedHours' },
        totalLoggedHours: { $sum: '$loggedHours' }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      total: 0,
      byStatus: {},
      byPriority: {},
      byType: {},
      totalEstimatedHours: 0,
      totalLoggedHours: 0
    };
  }
  
  const result = stats[0];
  
  // Count occurrences
  const countOccurrences = (arr: string[]) => {
    return arr.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };
  
  return {
    total: result.total,
    byStatus: countOccurrences(result.byStatus),
    byPriority: countOccurrences(result.byPriority),
    byType: countOccurrences(result.byType),
    totalEstimatedHours: result.totalEstimatedHours || 0,
    totalLoggedHours: result.totalLoggedHours || 0
  };
};

export const Issue = mongoose.model<IIssueDocument>('Issue', issueSchema) as unknown as IIssueModel;
