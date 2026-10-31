# Trade Finance & TaskFlowPro Backend API (v2.2)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Jest Tests](https://img.shields.io/badge/Tests-51%20Passed-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/Security-HMAC%20%7C%20RBAC%20%7C%20IDOR%20Hardened-success.svg)]()
[![Broker](https://img.shields.io/badge/RabbitMQ-DLQ%20%2B%20Idempotent-orange.svg)]()

A robust, enterprise-grade backend API built with **Node.js, Express, TypeScript, MongoDB, Redis, RabbitMQ, and Google Gemini 2.5 Flash**. Fully hardened according to the TaskFlowPro Solutions Guide across security, resilience, data performance, AI schema validation, and distributed request tracing.

---

## 🚀 Key Features & Production Hardening

* **🔐 Cryptographic Security & RBAC Baseline**:
  * Centralized environment validator rejecting weak or default secrets (< 16 characters).
  * Server-side trusted identity derivation (`req.user.id`) — client-passed IDs are discarded.
  * Role-based access control (`admin`, `manager`, `employee`) and object-level IDOR protection with field-level allowlists.
* **🛡️ Keyed HMAC OTP & Brute-Force Defense**:
  * 6-digit OTP stored as keyed SHA-256 HMAC (`crypto.createHmac`) in Redis with 10-minute TTL.
  * Atomic attempt tracking locking out abusers after 3 failed attempts (HTTP 429).
  * Timing-safe verification (`crypto.timingSafeEqual`) and atomic single-use deletion (`GETDEL`).
  * Strict authoritative Redis check (`requireAuthoritative: true`) returning HTTP 503 instead of falling back to in-memory store for critical auth credentials.
* **✉️ Resilient Event Broker (RabbitMQ DLX & Idempotent Worker)**:
  * Standardized message envelope (`eventId`, `eventType`, `version`, `retryCount`, `payload`).
  * Dead Letter Exchange (`taskflow_dlx`) and Dead Letter Queue (`taskflow_dead_letter_queue`).
  * MongoDB `ProcessedEvent` collection with 7-day TTL index ensuring at-least-once message processing without duplicate email deliveries.
  * Exponential backoff retry loop with graceful worker shutdown on `SIGTERM`/`SIGINT`.
* **⚡ High-Performance Data Layer & Read-Through Caching**:
  * Reusable bounded pagination (`parsePagination`) enforcing default 20 items, max 100 limit, and returning pagination metadata.
  * Compound MongoDB indexes on Tasks and Projects with deterministic tie-breaker sorting.
  * Read-through caching with automatic tag-based invalidation (`tasks`, `projects`) on mutations.
* **🤖 AI Co-Pilot & Schema Validation**:
  * 15-second explicit timeout (`AbortController`) on Gemini REST requests preventing hanging threads.
  * Strict JSON schema output validator (`validateStringArrayOutput`) handling markdown code fences.
  * Dedicated AI rate limiter (`aiLimiter` at 20 requests/minute).
  * Clear fallback labeling (`isFallback: true`) so clients know when AI vs. deterministic logic responded.
* **📊 Observability & Distributed Tracing**:
  * Automatic `X-Request-Id` correlation propagation across requests, responses, and error payloads.
  * Structured high-precision latency logger (`process.hrtime.bigint()`).
  * Orchestration health probes (`GET /health/live`, `GET /health/ready`).

---

## 🔗 API Endpoint Reference

### 🏥 Health & Operational Probes
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **GET** | `/health/live` | Liveness probe (HTTP 200) | No |
| **GET** | `/health/ready` | Readiness probe verifying MongoDB, Redis & RabbitMQ | No |
| **GET** | `/health` | Legacy health check | No |

### 🤖 AI Intelligence & Health Endpoints (`/api/ai`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **GET** | `/api/ai/project-health/:projectId?` | AI project health score, velocity & risks | **Yes** |
| **GET** | `/api/ai/executive-brief` | Daily executive morning brief | **Yes** |
| **GET** | `/api/ai/weekly-report` | Weekly performance intelligence report | **Yes** |
| **POST** | `/api/ai/qa` | Natural language project health Q&A | **Yes** |
| **POST** | `/api/ai/chat` | Conversational AI co-pilot | **Yes** |
| **POST** | `/api/ai/breakdown` | Generate validated task checklist (with fallback) | **Yes** |
| **POST** | `/api/ai/daily-plan` | Generate manager daily action items | **Yes** |

### 🎯 Skills Matrix Endpoints (`/api/skills`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **GET** | `/api/skills/my-skills` | Get logged-in user's skills profile | **Yes** |
| **GET** | `/api/skills/employee/:employeeId` | Get employee's skill matrix | **Yes** |
| **PUT** | `/api/skills/my-skills` | Update technical/soft skills & experience | **Yes** |
| **POST** | `/api/skills/suggest-employee` | Gemini AI employee recommendation for task | **Yes** |
| **GET** | `/api/skills/gap-analysis` | Team skill gap analysis | **Yes** |
| **GET** | `/api/skills/learning-recommendations` | AI personal learning roadmap | **Yes** |

### ⚡ Natural Language Command Center (`/api/command`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **POST** | `/api/command/command` | Execute natural language action with RBAC validation | **Yes** |

### 📁 Projects (`/api/projects`) & 📝 Tasks (`/api/tasks`)
| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---:|
| **GET** | `/api/projects` | List projects (bounded pagination) | **Yes** |
| **POST** | `/api/projects` | Create project (derived identity) | **Yes** |
| **GET** | `/api/tasks` | List tasks (bounded pagination) | **Yes** |
| **POST** | `/api/tasks` | Create task (derived identity) | **Yes** |

---

## ⚙️ Environment Configuration

Configuration is validated centrally at startup (`src/config/env.config.ts`).

### Required Variables
```env
PORT=5000
NODE_ENV=development # or 'production' / 'test'
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taskflowpro
JWT_SECRET=your_jwt_secret_key_minimum_16_characters
```

### Optional Integration Variables
```env
REFRESH_SECRET=your_refresh_secret # Defaults to JWT_SECRET if omitted
REDIS_URL=redis://127.0.0.1:6379   # Falls back safely for non-security caches
RABBITMQ_URL=amqp://localhost      # Async notification worker broker
GEMINI_API_KEY=your_gemini_key     # If omitted, AI gracefully falls back to deterministic logic
CORS_ORIGIN=http://localhost:4200  # Comma-separated allowed origins
```

---

## 🏎️ Running Locally & Testing

```bash
# Install dependencies
npm install

# Run automated tests (8 test suites, 51 tests)
npm test

# Seed initial database records
npm run seed

# Run backend API server
npm run dev

# Run RabbitMQ email worker
npm run worker
```
