import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { Attachment } from '../types';

// Comment Schema for DynamoDB
const commentSchema = new dynamoose.Schema({
  id: {
    type: String,
    hashKey: true
  },
  issueId: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'issueIdIndex'
    }
  },
  author: {
    type: String,
    required: true,
    index: {
      type: 'global',
      name: 'authorIndex'
    }
  },
  content: {
    type: String,
    required: true
  },
  attachments: {
    type: Array,
    schema: [Object],
    default: []
  }
}, {
  timestamps: true,
  saveUnknown: false
});

// Comment class
class CommentClass extends Item {
  id!: string;
  issueId!: string;
  author!: string;
  content!: string;
  attachments!: Attachment[];
  createdAt!: Date;
  updatedAt!: Date;

  // Instance method to update content
  async updateContent(content: string): Promise<CommentClass> {
    this.content = content;
    this.updatedAt = new Date();
    await this.save();
    return this;
  }

  // Instance method to add attachment
  async addAttachment(attachment: Attachment): Promise<CommentClass> {
    this.attachments.push(attachment);
    await this.save();
    return this;
  }

  // Instance method to remove attachment
  async removeAttachment(attachmentId: string): Promise<CommentClass> {
    this.attachments = this.attachments.filter(
      (attachment: Attachment) => attachment._id !== attachmentId
    );
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
export const Comment = dynamoose.model<CommentClass>('Comment', commentSchema, {
  create: process.env.NODE_ENV === 'development',
  update: process.env.NODE_ENV === 'development'
});

// Static method to find comments by issue
(Comment as any).findByIssue = async function(issueId: string) {
  return await Comment.query('issueId').eq(issueId).using('issueIdIndex').exec();
};

// Static method to find comments by author
(Comment as any).findByAuthor = async function(authorId: string) {
  return await Comment.query('author').eq(authorId).using('authorIndex').exec();
};

// Static method to get comment statistics for an issue
(Comment as any).getCommentStats = async function(issueId: string) {
  const comments = await Comment.query('issueId').eq(issueId).using('issueIdIndex').exec();
  
  const authorSet = new Set();
  let totalAttachments = 0;
  
  comments.forEach((comment: CommentClass) => {
    authorSet.add(comment.author);
    totalAttachments += comment.attachments.length;
  });
  
  return {
    totalComments: comments.length,
    totalAttachments,
    uniqueAuthors: authorSet.size
  };
};
