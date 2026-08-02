# Trade Finance & TaskFlowPro Backend API (v2.2)

A robust, enterprise-grade backend API built with **Node.js, Express, TypeScript, MongoDB, Redis, RabbitMQ, and Google Gemini 2.5 Flash**.

---

## 🚀 Key Features

* **🤖 AI Project Health Center**: MongoDB multi-collection aggregation pipelines evaluating continuous project health scores, predictive risk analysis, and velocity completion forecasting using Gemini 2.5 Flash.
* **🎯 AI Skills Matrix & Resource Allocation**: Employee skill profile tracking (⭐ 1-5 stars) and AI employee recommendation engine for tasks and projects.
* **💬 AI Command Center (Natural Language Actions)**: Natural language command parsing, entity extraction, RBAC authorization validation, and direct execution against MongoDB collections.
* **🔐 Secure Authentication**: JWT session management, HttpOnly cookies, salted bcrypt passwords, OTP reset workflows, and role-based access control.
* **✉️ Async Event Broker (RabbitMQ)**: Non-blocking background email queues (`project_assigned_queue`, `task_assigned_queue`).
* **📍 Geofenced Attendance Engine**: Spherical Law of Cosines distance calculation for 10-meter office check-in enforcement.

---

## 🔗 API Endpoint Reference

### 🤖 AI Intelligence & Health Endpoints (`/api/ai`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **GET** | `/api/ai/project-health/:projectId?` | Get AI project health report & score | **Yes** |
| **GET** | `/api/ai/executive-brief` | Get daily morning executive brief | **Yes** |
| **GET** | `/api/ai/weekly-report` | Get weekly performance report | **Yes** |
| **POST** | `/api/ai/qa` | Natural language project Q&A | **Yes** |
| **POST** | `/api/ai/chat` | Conversational AI chat | **Yes** |
| **POST** | `/api/ai/breakdown` | Generate task breakdown checklist | **Yes** |

---

### 🎯 Skills Matrix Endpoints (`/api/skills`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **GET** | `/api/skills/my-skills` | Get logged-in user's skills profile | **Yes** |
| **GET** | `/api/skills/employee/:employeeId` | Get employee's skill matrix | **Yes** |
| **PUT** | `/api/skills/my-skills` | Update technical/soft skills & experience | **Yes** |
| **POST** | `/api/skills/suggest-employee` | Gemini AI employee recommendation for task | **Yes** |
| **GET** | `/api/skills/gap-analysis` | Get team skill gap analysis | **Yes** |
| **GET** | `/api/skills/learning-recommendations` | Get AI personal learning roadmap | **Yes** |

---

### ⚡ Natural Language Command Center (`/api/command`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **POST** | `/api/command/command` | Execute natural language action with RBAC validation | **Yes** |

---

### 📁 Projects (`/api/projects`) & 📝 Tasks (`/api/tasks`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **GET** | `/api/projects` | Fetch all projects | **Yes** |
| **POST** | `/api/projects` | Create new project | **Yes** |
| **GET** | `/api/tasks` | Fetch all tasks | **Yes** |
| **POST** | `/api/tasks` | Create new task | **Yes** |

---

## ⚙️ Environment Variables (.env)

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taskflowpro
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_google_gemini_api_key
RABBITMQ_URL=amqps://username:password@hostname.rmq.cloudamqp.com/vhost
```

---

## 🏎️ Running Locally

```bash
# Install dependencies
npm install

# Seed initial database records
npm run seed

# Run backend API server
npm run dev

# Run RabbitMQ email worker
npm run worker
```
