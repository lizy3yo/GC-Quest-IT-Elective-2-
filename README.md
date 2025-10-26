# GC Quest 🎯

An intelligent flashcard learning platform designed for modern education, featuring adaptive study modes and spaced repetition for effective knowledge retention.

## 📖 Overview

GC Quest is a comprehensive flashcard learning system that combines:
- **Smart Flashcards**: Create custom flashcard decks with rich media support
- **Adaptive Learning**: AI-powered system that adjusts to your learning pace
- **Spaced Repetition**: Scientifically-proven method for long-term retention
- **Study Modes**: Multiple learning approaches including Learn Mode, Test Mode, and Match Games

## 🏗️ Project Structure

```
GC Quest/
├── README.md                    # Project documentation
├── .vscode/                     # VS Code settings
│   └── settings.json
├── client/                      # Frontend (Next.js)
└── server/                      # Backend (Node.js + Express + TypeScript + Mongoose)
```

## 🎨 Frontend (Client)

**Tech Stack**: Next.js 15 + TypeScript + Tailwind CSS

```
client/
├── src/
│   └── app/                     # Next.js App Router
│       ├── globals.css          # Global styles with Tailwind
│       ├── layout.tsx           # Root layout component
│       ├── page.tsx             # Home page (renders landing page)
│       ├── landing_page/
│       │   └── landingpage.tsx  # Flashcard platform landing page
│       ├── auth/
│       │   └── admin_login.tsx  # Admin login component
│       ├── admin_page/          # Admin dashboard (planned)
│       └── user_page/           # User interface (planned)
├── public/                      # Static assets
│   ├── images.png              # Logo
│   └── *.svg                   # Icons
├── package.json                # Dependencies & scripts
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── postcss.config.mjs          # PostCSS configuration for Tailwind
└── eslint.config.mjs           # ESLint configuration
```

### Key Frontend Features
- Responsive design with Tailwind CSS
- Modern UI with gradients and smooth animations
- Modular React components
- TypeScript for type safety

### Frontend Scripts
```bash
npm run dev        # Start development server (with Turbopack)
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
```

## ⚙️ Backend (Server)

**Tech Stack**: Node.js + Express + TypeScript + Mongoose + MongoDB

```
server/
├── src/
│   ├── server.ts               # Main server file & Express app setup
│   ├── config/                 # Configuration (env, constants)
│   ├── lib/                    # Libraries (JWT, rate limit, winston, mongoose)
│   ├── middlewares/            # Express middlewares (auth, validation, etc.)
│   ├── models/                 # Mongoose models (User, Token)
│   ├── routes/
│   │   └── v1/                 # API v1 routes (auth, user, etc.)
│   ├── controllers/            # Route controllers (auth, user, etc.)
│   └── utils/                  # Utility functions
├── .env                        # Environment variables
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
└── LICENSE                     # Apache 2.0 License
```

### Key Backend Features
- RESTful API with Express
- JWT-based authentication (access & refresh tokens)
- Role-based authorization (student, teacher, admin)
- MongoDB with Mongoose ODM
- Rate limiting, security headers, and logging (Winston)
- User registration, login, logout, and profile management
- Admin endpoints for user management

### Backend Scripts
```bash
npm run dev           # Start development server with nodemon
```

## 🗄️ Database Schema

**Database**: MongoDB (via Mongoose)

### Core Models

#### User
- username (unique)
- email (unique)
- password (hashed)
- role (student | teacher | admin)
- firstName
- lastName
- socialLinks (optional)
- timestamps

#### Token
- token (refresh token)
- userId (reference to User)

## 🔧 API Endpoints

### Authentication
```
POST   /api/v1/auth/register      # User registration
POST   /api/v1/auth/login         # User login
POST   /api/v1/auth/logout        # Logout (clear tokens)
POST   /api/v1/auth/refresh-token # Refresh access token
```

### Users
```
GET    /api/v1/users/current      # Get current user profile (auth required)
PUT    /api/v1/users/current      # Update current user profile (auth required)
DELETE /api/v1/users/current      # Delete current user (auth required)
GET    /api/v1/users             # List all users (admin only)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB database
- npm or yarn

### Environment Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd "GC Quest"
```

2. **Set up environment variables**
```bash
# In server/.env
PORT=6000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/gc-quest-db
LOG_LEVEL=info
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=1w
```

3. **Install dependencies**
```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

4. **Start development servers**
```bash
# Terminal 1 - Backend
cd server
npm run dev            # Starts on http://localhost:6000

# Terminal 2 - Frontend
cd client
npm run dev            # Starts on http://localhost:3000
```

## 🔒 Authentication Flow

1. Registration: User creates account with email and password
2. Login: User authenticates and receives JWT tokens (access & refresh)
3. Protected Routes: Access token required in Authorization header
4. Refresh: Use refresh token to obtain new access token
5. Role-based Access: Admin endpoints protected by role

## 🎯 Current Features

✅ **Implemented**
- Modern flashcard-focused landing page
- User registration and authentication
- JWT token-based security
- MongoDB database integration
- Responsive design with gradient theming
- Smooth scroll navigation

🚧 **In Development**
- Flashcard deck creation and management
- Spaced repetition algorithm
- Adaptive learning system
- Study session tracking
- Progress analytics
- Public deck browsing

## 📄 License

This project is licensed under the Apache 2.0 License.

---

**GC Quest** - Master Any Subject with