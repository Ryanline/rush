# Rush

Live speed-dating web app with real-time matchmaking, timed chat, and gem-based match extension.

## Monorepo Structure

- `apps/web`: React + Vite frontend
- `services/api`: Fastify + Prisma backend (HTTP + WebSocket)
- `infra/k8s/base`: Generic Kubernetes base manifests
- `infra/k3s`: Current EC2 + k3s deployment manifests

## Live Architecture (Current)

- Frontend hosting: Cloudflare Pages (`rush-app-ava.pages.dev`)
- Backend hosting: AWS EC2 (`k3s`) + NGINX ingress + cert-manager
- API domain: `rush-api-ryan.duckdns.org`
- Database: in-cluster PostgreSQL (Kubernetes Deployment + PVC)

How traffic flows:

1. Browser loads app from Cloudflare Pages.
2. Frontend calls API at `https://rush-api-ryan.duckdns.org`.
3. WebSocket connects to `wss://rush-api-ryan.duckdns.org/ws`.
4. Ingress terminates TLS and routes to API service in k3s.

## Local Development

### 1) Start Postgres

```bash
docker compose up db -d
```

### 2) Configure env files

```bash
copy apps\web\.env.example apps\web\.env.local
copy services\api\.env.example services\api\.env
```

### 3) Install dependencies

```bash
npm ci
```

### 4) Generate Prisma client and run migrations

```bash
npm run prisma:generate --workspace api
npm run prisma:migrate:dev --workspace api
```

### 5) Run API + web in two terminals

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open:

- Web: `http://localhost:5173`
- API health: `http://localhost:3001/health/live`

## Docker Compose (Full Stack)

```bash
npm run compose:up
```

Open:

- Web: `http://localhost:8080`
- API: `http://localhost:3001`

Stop:

```bash
npm run compose:down
```

## Auth and Real-Time Flow

1. Signup/Login returns JWT.
2. Frontend stores JWT and validates session via `GET /me` on boot.
3. Queue and Match pages connect to WS with `?token=<jwt>`.
4. Server verifies JWT and runs matchmaking/chat/extend logic.

## Scripts

- Root:
  - `npm run dev:web`
  - `npm run dev:api`
  - `npm run build:web`
  - `npm run build:api`
  - `npm run test:api`
- API:
  - `npm run prisma:generate --workspace api`
  - `npm run prisma:migrate:dev --workspace api`
  - `npm run prisma:migrate:deploy --workspace api`

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- install
- prisma generate + migrate deploy
- web lint + build
- api typecheck + tests

## CD (Backend)

GitHub Actions workflow at `.github/workflows/backend-cd.yml`:

1. Triggers on pushes to `main` that affect backend/workflow files.
2. Builds and pushes Docker image to Docker Hub:
   - `<dockerhub-username>/rush-api:latest`
   - `<dockerhub-username>/rush-api:<git-sha>`
3. SSHes to EC2 and updates the `rush-api` deployment image.
4. Waits for rollout success.

Required GitHub repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

## Kubernetes (Base)

Base manifests are under `infra/k8s/base`:

- namespace
- API deployment/service with health probes
- Web deployment/service
- ingress
- example secret template

Apply:

```bash
kubectl apply -k infra/k8s/base
```

Create your real secret first based on:

- `infra/k8s/base/secrets.example.yaml`

## Deployment Notes

- Use managed Postgres in production.
- Set strong `JWT_SECRET`.
- Set `CORS_ORIGINS` to your deployed frontend domain(s).
- Build frontend with production `VITE_API_URL` and `VITE_WS_URL`.

## Cost Controls

Set up AWS budget alerts before continuing production work:

- See [docs/aws-budget-alarms.md](docs/aws-budget-alarms.md)
