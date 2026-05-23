# Trade Finance & TaskFlow Pro Backend

A robust, enterprise-grade backend API built with **Node.js, Express, TypeScript, MongoDB, and RabbitMQ**. It supports secure User Authentication, Forward Contract workflows, and a real-time collaborative Project & Task management system powered by message-queue email workers.

---

## 🚀 Key Features

* **🔐 Secure Authentication**: JWT-based session management, cookies, salted bcrypt passwords, password reset workflow with OTPs.
* **📈 Forward Contracts**: Complete lifecycle management for forward contracts (Draft, Saved, Submitted, and Status transitions).
* **📋 Project & Task Management**: Multi-user task assignment with project organization.
* **✉️ Async Event Broker (RabbitMQ)**: Non-blocking, background email processing via message queues (`project_assigned_queue` and `task_assigned_queue`).
* **📧 Professional Notifications**: Custom HTML templates for project and task assignments powered by NodeMailer.

---

## 🛠️ Technology Stack

* **Runtime**: Node.js (v18+)
* **Language**: TypeScript (`ts-node`)
* **Framework**: Express.js
* **Database**: MongoDB (via Mongoose)
* **Message Broker**: RabbitMQ (via `amqplib` and CloudAMQP)
* **Email Sender**: Nodemailer (SMTP)

---

## 📂 Project Structure

```text
├── src/
│   ├── app.ts            # App initialization, global middlewares, health checks
│   ├── server.ts         # Server entry point
│   ├── config/           # Database & environment configurations
│   ├── controllers/      # Route request/response handlers
│   ├── middleware/       # JWT auth & helper middlewares
│   ├── models/           # Mongoose schemas & TypeScript interfaces
│   ├── routes/           # REST API endpoints mapping
│   ├── types/            # Custom TypeScript types
│   ├── utils/            # Shared utilities (e.g. rabbitmq publisher)
│   └── workers/          # Background worker tasks (e.g. email queue consumers)
├── .env                  # Configuration variables
├── tsconfig.json         # TypeScript configurations
├── package.json          # Dependency definitions
└── README.md             # Project documentation
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root folder with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?appName=<app>

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Email SMTP Config (Nodemailer)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-smtp-app-password

# RabbitMQ Configuration (CloudAMQP)
# IMPORTANT: Must start with amqps:// or amqp:// (Copy directly from your CloudAMQP dashboard)
RABBITMQ_URL=amqps://username:password@hostname.rmq.cloudamqp.com/vhost
```

---

## 🏎️ Getting Started

### 1. Installation
Install all backend dependencies:
```bash
npm install
```

### 2. Database Seeding (Optional)
If you need to seed initial users or projects:
```bash
# Seed initial users/roles
npm run seed

# Seed default projects
npm run seed:projects
```

### 3. Run Development Server
Launches the Express API server with automatic hot-reloading (`nodemon`):
```bash
npm run dev
```

### 4. Run Message Worker
Starts the background RabbitMQ consumer queue worker to process & send email notifications asynchronously:
```bash
npm run worker
```

---

## 🔗 API Reference

### 👤 User Endpoints (`/api/users`)

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| **GET** | `/api/users` | Fetch all users | No |
| **GET** | `/api/users/employees` | Fetch only employees | No |
| **GET** | `/api/users/:id` | Fetch user details by ID | No |
| **POST** | `/api/users` | Register a new user | No |
| **POST** | `/api/users/login` | Login user & issue JWT | No |
| **POST** | `/api/users/logout` | Clear user session cookies | No |
| **POST** | `/api/users/forgot-password` | Request password reset OTP | No |
| **POST** | `/api/users/reset-password`| Reset password using OTP | No |
| **PUT** | `/api/users/:id` | Update user details | No |

---

### 📑 Forward Contracts (`/api/forward-contracts`)

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| **GET** | `/api/forward-contracts` | Get all forward contracts | No |
| **GET** | `/api/forward-contracts/:id` | Get contract details by ID | No |
| **GET** | `/api/forward-contracts/reference/:refNumber` | Get contract by unique Ref Number | No |
| **GET** | `/api/forward-contracts/customer/:customerId` | Get all contracts for a specific customer | No |
| **POST** | `/api/forward-contracts` | Create & **Submit** forward contract | No |
| **POST** | `/api/forward-contracts/save` | Create & Save forward contract | No |
| **POST** | `/api/forward-contracts/draft` | Create & Save forward contract as **Draft** | No |
| **PUT** | `/api/forward-contracts/:id` | Update contract details | No |
| **PATCH** | `/api/forward-contracts/:id/status` | Update contract status only | No |
| **DELETE**| `/api/forward-contracts/:id` | Delete a contract | No |

---

### 📁 Projects (`/api/projects`)

*🛡️ All project endpoints require `Authorization: Bearer <JWT_TOKEN>` header.*

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| **GET** | `/api/projects` | Fetch all projects | **Yes** |
| **GET** | `/api/projects/:id` | Get project by ID | **Yes** |
| **POST** | `/api/projects` | Create a new project *(Triggers RabbitMQ project assignment event)* | **Yes** |
| **PUT** | `/api/projects/:id` | Update project details | **Yes** |
| **DELETE**| `/api/projects/:id` | Delete project | **Yes** |

---

### 📝 Tasks (`/api/tasks`)

*🛡️ All task endpoints require `Authorization: Bearer <JWT_TOKEN>` header.*

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| **GET** | `/api/tasks` | Fetch all tasks | **Yes** |
| **GET** | `/api/tasks/:id` | Get task by ID | **Yes** |
| **POST** | `/api/tasks` | Create a new task *(Triggers RabbitMQ task assignment event)* | **Yes** |
| **PUT** | `/api/tasks/:id` | Update task details | **Yes** |
| **DELETE**| `/api/tasks/:id` | Delete task | **Yes** |

---

## 🏗️ How RabbitMQ Works in this Backend

1. **Triggering Event**: When a user creates a new project or task and assigns it to members (e.g., via `POST /api/projects` or `POST /api/tasks`), the controller publishes a message to RabbitMQ using:
   ```typescript
   await publishToQueue('project_assigned_queue', { projectId, projectName, assigneeIds });
   ```
2. **Queuing**: RabbitMQ receives and queues the message persistently in the broker.
3. **Consumption**: The background **worker process** (`npm run worker`) consumes messages from the queue.
4. **Email Delivery**: The worker resolves the user emails from MongoDB, generates custom HTML styled templates, and sends emails asynchronously via Nodemailer (Gmail SMTP). This keeps the main API request lightning fast!
