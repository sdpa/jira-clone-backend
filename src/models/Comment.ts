import mongoose, { Schema } from 'mongoose';
import { IComment, ICommentModel, Attachment } from '../types';

const attachmentSchema = new Schema<Attachment>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  uploadedBy: { type: String, required: true, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const commentSchema = new Schema<IComment>({
  issueId: {
    type: String,
    required: true,
    ref: 'Issue'
  },
  author: {
    type: String,
    required: true,
    ref: 'User'
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  attachments: [attachmentSchema]
}, {
  timestamps: true
});

// Indexes
commentSchema.index({ issueId: 1 });
commentSchema.index({ author: 1 });
commentSchema.index({ createdAt: -1 });

// Compound indexes for common queries
commentSchema.index({ issueId: 1, createdAt: -1 });

// Virtual for comment URL
commentSchema.virtual('url').get(function() {
  return `/issues/${this.issueId}/comments/${this._id}`;
});

// Instance method to update comment
commentSchema.methods.updateContent = function(content: string) {
  this.content = content;
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to add attachment
commentSchema.methods.addAttachment = function(attachment: Attachment) {
  this.attachments.push(attachment);
  return this.save();
};

// Instance method to remove attachment
commentSchema.methods.removeAttachment = function(attachmentId: string) {
  this.attachments = this.attachments.filter(
    (attachment: Attachment) => attachment._id.toString() !== attachmentId
  );
  return this.save();
};

// Static method to find comments by issue
commentSchema.statics.findByIssue = function(issueId: string) {
  return this.find({ issueId })
    .populate('author', 'firstName lastName email avatar')
    .sort({ createdAt: 1 });
};

// Static method to find comments by author
commentSchema.statics.findByAuthor = function(authorId: string) {
  return this.find({ author: authorId })
    .populate('issueId', 'title key')
    .sort({ createdAt: -1 });
};

// Static method to get comment statistics for an issue
commentSchema.statics.getCommentStats = async function(issueId: string) {
  const stats = await this.aggregate([
    { $match: { issueId } },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        totalAttachments: { $sum: { $size: '$attachments' } },
        authors: { $addToSet: '$author' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalComments: 0,
      totalAttachments: 0,
      uniqueAuthors: 0
    };
  }

  return {
    totalComments: stats[0].totalComments,
    totalAttachments: stats[0].totalAttachments,
    uniqueAuthors: stats[0].authors.length
  };
};

export const Comment = mongoose.model<IComment, ICommentModel>('Comment', commentSchema);
