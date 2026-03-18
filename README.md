# 🌐 Orbis CRM

> Enterprise-grade CRM platform built with Rust + React

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | Rust + Axum                         |
| Database   | PostgreSQL 16                       |
| Cache      | Redis 7                             |
| Frontend   | React + Vite + TypeScript           |
| Styling    | Tailwind CSS v4                     |
| ORM        | SQLx                                |
| Email      | Resend                              |

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Rust (https://rustup.rs)
- Node.js 20+

### 1. Start Database + Redis
```bash
docker-compose up -d
```

### 2. Start Backend
```bash
cd backend
cp .env.example .env
cargo run
```
Backend runs at: http://localhost:8080

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:5173

---

## 📁 Project Structure

```
orbis-crm/
├── docker-compose.yml      # Postgres + Redis
├── backend/                # Rust + Axum API
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── config.rs       # Environment config
│   │   ├── errors.rs       # Error types
│   │   ├── state.rs        # App state (DB pool, Redis)
│   │   ├── db/             # Database layer
│   │   └── routes/         # API routes
│   └── Cargo.toml
└── frontend/               # React + Vite
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   └── lib/
    │       ├── constants.ts # App config (name, urls)
    │       └── api.ts       # Axios instance
    └── package.json
```

---

## 🔄 Rename the App

To rename from "Orbis" to anything else — change just **2 lines**:

1. `backend/.env` → `APP_NAME=YourNewName`
2. `frontend/.env` → `VITE_APP_NAME=YourNewName`

That's it. ✅

---

## 📝 License

Private & Confidential
