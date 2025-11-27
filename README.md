# JIRA Clone - Backend API

A robust backend API for the JIRA Clone application built with TypeScript, Node.js, Express, and MongoDB.

## 🚀 Features

- **RESTful API** - Clean and well-structured REST endpoints
- **User Authentication** - JWT-based authentication and authorization
- **Project Management** - Full CRUD operations for projects
- **Issue Tracking** - Comprehensive issue management
- **Comments System** - Threaded comments and discussions
- **Real-time Updates** - Socket.IO for live updates
- **Role-based Access Control** - Granular permissions system
- **Input Validation** - Joi schema validation
- **Security** - Rate limiting, Helmet.js, CORS protection

## 🏗️ Tech Stack

- **Node.js** - Runtime environment
- **TypeScript** - Type safety
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **Socket.IO** - Real-time communication
- **Joi** - Request validation
- **bcrypt** - Password hashing

## 📋 Prerequisites

- Node.js 16+
- MongoDB 4.4+
- npm or yarn

## 🛠️ Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start MongoDB**
   ```bash
   mongod
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:5000`

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/jira-clone

# JWT
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/profile` - Update profile (protected)
- `POST /api/auth/logout` - User logout (protected)

### Project Endpoints

- `GET /api/projects` - Get user's projects (protected)
- `POST /api/projects` - Create new project (protected)
- `GET /api/projects/:id` - Get project details (protected)
- `PUT /api/projects/:id` - Update project (protected)
- `DELETE /api/projects/:id` - Delete project (protected)
- `POST /api/projects/:id/members` - Add member (protected)
- `DELETE /api/projects/:id/members/:userId` - Remove member (protected)

### Issue Endpoints

- `GET /api/issues` - Get issues with filtering (protected)
- `POST /api/issues` - Create new issue (protected)
- `GET /api/issues/:id` - Get issue details (protected)
- `PUT /api/issues/:id` - Update issue (protected)
- `DELETE /api/issues/:id` - Delete issue (protected)

### Comment Endpoints

- `POST /api/issues/:issueId/comments` - Add comment (protected)
- `GET /api/issues/:issueId/comments` - Get comments (protected)
- `PUT /api/comments/:id` - Update comment (protected)
- `DELETE /api/comments/:id` - Delete comment (protected)

For detailed API documentation, see [openapi.yaml](./openapi.yaml)

## 🗂️ Project Structure

```
backend/
├── src/
│   ├── index.ts              # Application entry point
│   ├── middleware/
│   │   └── auth.ts          # Authentication middleware
│   ├── models/              # Mongoose models
│   │   ├── User.ts
│   │   ├── Project.ts
│   │   ├── Issue.ts
│   │   └── Comment.ts
│   ├── routes/              # API routes
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   ├── issues.ts
│   │   └── comments.ts
│   └── types/
│       └── index.ts         # TypeScript type definitions
├── dist/                    # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - API protection against abuse
- **Input Validation** - Joi schema validation on all inputs
- **CORS Protection** - Cross-origin request security
- **Helmet.js** - Security headers
- **Role-based Access** - Granular permission system

## 🗄️ Database Models

### User
- Authentication and profile information
- Roles and permissions
- Project associations

### Project
- Project metadata and settings
- Team members and roles
- Custom configurations

### Issue
- Issue details and metadata
- Status, priority, type
- Assignees and watchers
- Time tracking

### Comment
- User comments on issues
- Timestamps and authorship
- Nested comment support

## 🚀 Deployment

### Production Build

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```bash
   NODE_ENV=production
   ```

3. **Start the server**
   ```bash
   npm start
   ```

### Docker Deployment

```bash
docker build -t jira-clone-backend .
docker run -p 5000:5000 --env-file .env jira-clone-backend
```

### Environment Checklist for Production

- [ ] Set `NODE_ENV=production`
- [ ] Use production MongoDB instance
- [ ] Set secure `JWT_SECRET`
- [ ] Configure proper CORS origins
- [ ] Set up SSL/HTTPS
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Enable database backups
- [ ] Configure error reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Related Repositories

- [Frontend Repository](https://github.com/your-username/jira-clone-frontend)

---

Built with ❤️ using TypeScript and Node.js

