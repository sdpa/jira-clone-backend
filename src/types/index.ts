import { Document, Model } from 'mongoose';
import { Request } from 'express';

// User Types
export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  PROJECT_MANAGER = 'project_manager',
  DEVELOPER = 'developer',
  DESIGNER = 'designer',
  QA = 'qa',
  VIEWER = 'viewer'
}

// Project Types
export interface IProject extends Document {
  _id: string;
  name: string;
  description?: string;
  key: string;
  owner: string; // User ID
  members: string[]; // User IDs
  settings: ProjectSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Custom methods
  addMember(userId: string): Promise<IProject>;
  removeMember(userId: string): Promise<IProject>;
  isMember(userId: string): boolean;
}

export interface ProjectSettings {
  defaultAssignee?: string;
  issueTypes: IssueType[];
  priorities: Priority[];
  statuses: Status[];
}

// Issue Types
export interface IIssue extends Document {
  _id: string;
  projectId: string;
  key: string; // e.g., PROJ-123
  title: string;
  description?: string;
  type: IssueType;
  priority: Priority;
  status: Status;
  assignee?: string; // User ID
  reporter: string; // User ID
  labels: string[];
  components: string[];
  fixVersion?: string;
  dueDate?: Date;
  estimatedHours?: number;
  loggedHours: number;
  attachments: Attachment[];
  comments: Comment[];
  watchers: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
  // Custom methods
  addComment(authorId: string, content: string, attachments?: Attachment[]): Promise<IIssue>;
  addWatcher(userId: string): Promise<IIssue>;
  removeWatcher(userId: string): Promise<IIssue>;
  logTime(hours: number): Promise<IIssue>;
  updateStatus(status: Status): Promise<IIssue>;
}

export enum IssueType {
  BUG = 'bug',
  TASK = 'task',
  STORY = 'story',
  EPIC = 'epic',
  SUBTASK = 'subtask'
}

export enum Priority {
  LOWEST = 'lowest',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  HIGHEST = 'highest'
}

export enum Status {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

// Comment Types
export interface Comment {
  _id: string;
  author: string; // User ID
  content: string;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IComment extends Document {
  _id: string;
  issueId: string;
  author: string; // User ID
  content: string;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
  // Custom methods
  updateContent(content: string): Promise<IComment>;
  addAttachment(attachment: Attachment): Promise<IComment>;
  removeAttachment(attachmentId: string): Promise<IComment>;
}

// Attachment Types
export interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string; // User ID
  uploadedAt: Date;
}

// Board Types
export interface IBoard extends Document {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  type: BoardType;
  columns: BoardColumn[];
  filters: BoardFilter;
  settings: BoardSettings;
  createdAt: Date;
  updatedAt: Date;
}

export enum BoardType {
  KANBAN = 'kanban',
  SCRUM = 'scrum'
}

export interface BoardColumn {
  _id: string;
  name: string;
  statuses: Status[];
  isDone: boolean;
  limit?: number;
}

export interface BoardFilter {
  assignee?: string[];
  labels?: string[];
  components?: string[];
  issueTypes?: IssueType[];
  priorities?: Priority[];
}

export interface BoardSettings {
  showSubTasks: boolean;
  showEpics: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // in seconds
}

// Sprint Types (for Scrum boards)
export interface ISprint extends Document {
  _id: string;
  projectId: string;
  boardId: string;
  name: string;
  goal?: string;
  startDate: Date;
  endDate: Date;
  issues: string[]; // Issue IDs
  status: SprintStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum SprintStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Request Types
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// Filter and Search Types
export interface IssueFilter {
  projectId?: string;
  assignee?: string;
  reporter?: string;
  status?: Status[];
  priority?: Priority[];
  type?: IssueType[];
  labels?: string[];
  components?: string[];
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// WebSocket Types
export interface SocketUser {
  userId: string;
  socketId: string;
  projectId?: string;
}

export interface SocketEvent {
  type: string;
  data: any;
  userId: string;
  projectId?: string;
  timestamp: Date;
}

// Model interfaces with static methods
export interface IProjectModel extends Model<IProject> {
  findByUser(userId: string): any;
  generateUniqueKey(name: string): Promise<string>;
}

export interface IIssueModel extends Model<IIssue> {
  generateUniqueKey(projectKey: string): Promise<string>;
  findByProject(projectId: string): any;
  findByAssignee(assigneeId: string): any;
  getStatistics(projectId: string): Promise<any>;
}

export interface ICommentModel extends Model<IComment> {
  findByIssue(issueId: string): any;
  findByAuthor(authorId: string): any;
  getCommentStats(issueId: string): Promise<any>;
}
