import mongoose, { Schema } from 'mongoose';
import { IProject, IProjectModel, ProjectSettings, IssueType, Priority, Status } from '../types';

const projectSettingsSchema = new Schema<ProjectSettings>({
  defaultAssignee: {
    type: String,
    ref: 'User'
  },
  issueTypes: [{
    type: String,
    enum: Object.values(IssueType),
    default: [IssueType.TASK, IssueType.BUG, IssueType.STORY]
  }],
  priorities: [{
    type: String,
    enum: Object.values(Priority),
    default: [Priority.LOW, Priority.MEDIUM, Priority.HIGH]
  }],
  statuses: [{
    type: String,
    enum: Object.values(Status),
    default: [Status.TODO, Status.IN_PROGRESS, Status.DONE]
  }]
}, { _id: false });

const projectSchema = new Schema<IProject>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  key: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{2,10}$/, 'Project key must be 2-10 uppercase letters']
  },
  owner: {
    type: String,
    required: true,
    ref: 'User'
  },
  members: [{
    type: String,
    ref: 'User'
  }],
  settings: {
    type: projectSettingsSchema,
    default: () => ({
      issueTypes: [IssueType.TASK, IssueType.BUG, IssueType.STORY],
      priorities: [Priority.LOW, Priority.MEDIUM, Priority.HIGH],
      statuses: [Status.TODO, Status.IN_PROGRESS, Status.DONE]
    })
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
projectSchema.index({ key: 1 });
projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });
projectSchema.index({ isActive: 1 });

// Virtual for member count
projectSchema.virtual('memberCount').get(function() {
  return this.members.length + 1; // +1 for owner
});

// Pre-save middleware to ensure owner is in members
projectSchema.pre('save', function(next) {
  if (this.owner && !this.members.includes(this.owner)) {
    this.members.push(this.owner);
  }
  next();
});

// Instance method to add member
projectSchema.methods.addMember = function(userId: string) {
  if (!this.members.includes(userId)) {
    this.members.push(userId);
  }
  return this.save();
};

// Instance method to remove member
projectSchema.methods.removeMember = function(userId: string) {
  this.members = this.members.filter((member: string) => member.toString() !== userId);
  return this.save();
};

// Instance method to check if user is member
projectSchema.methods.isMember = function(userId: string): boolean {
  return this.owner.toString() === userId || this.members.includes(userId);
};

// Static method to find projects by user
projectSchema.statics.findByUser = function(userId: string) {
  return this.find({
    $or: [
      { owner: userId },
      { members: userId }
    ],
    isActive: true
  });
};

// Static method to generate unique project key
projectSchema.statics.generateUniqueKey = async function(name: string): Promise<string> {
  const baseKey = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 10);
  
  let key = baseKey;
  let counter = 1;
  
  while (await this.findOne({ key })) {
    key = `${baseKey}${counter}`;
    counter++;
  }
  
  return key;
};

export const Project = mongoose.model<IProject, IProjectModel>('Project', projectSchema);
