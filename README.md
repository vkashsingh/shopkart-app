# ShopKart

## ShopKart project map

| Repo | What it holds | Changed by |
|---|---|---|
| [shopkart-app](https://github.com/vkashsingh/shopkart-app) | App code (React, Node.js), Dockerfiles, docker compose, Jenkinsfile | Developers |
| [shopkart-infra](https://github.com/vkashsingh/shopkart-infra) | Terraform: Jenkins master EC2, EKS cluster | DevOps |
| [shopkart-gitops](https://github.com/vkashsingh/shopkart-gitops) | Kubernetes YAML + Argo CD Application (what runs in EKS) | Jenkins (image tag), Argo CD (sync) |

**Flow:** push to shopkart-app → Jenkins (tests, SonarQube, OWASP, Trivy, build, push to Docker Hub) → Jenkins updates the image tag in shopkart-gitops → Argo CD syncs to EKS → Prometheus/Grafana monitor.

**You are here: shopkart-app**

ShopKart is a lightweight product catalogue application with a React single-page frontend and a Node.js/Express REST backend backed by MongoDB. It provides full CRUD operations for product inventory along with Prometheus metrics, structured JSON logging, and containerized deployment.

## Architecture

```text
browser -> nginx :8080 -> backend :8080 -> mongo :27017
```

- **Frontend (`shop-frontend`)**: React 19 + Vite SPA served via `nginx-unprivileged:1.27-alpine` running as a non-root user on container port `8080` (mapped to host port `3000`).
  - Serves static assets with gzip compression and SPA fallback (`try_files $uri /index.html`).
  - Proxies `/api/` requests directly to `http://shop-backend:8080`.
  - Exposes `/nginx-health` for HTTP health checks.
- **Backend (`shop-backend`)**: Node.js 24 + Express 5 running on container port `8080` as non-root user `node`.
  - REST API at `/api/products` (CRUD operations).
  - Liveness check at `/health` (HTTP 200).
  - Readiness check at `/ready` (verifies MongoDB connection).
  - Prometheus metrics at `/metrics` (request counts and duration histograms).
  - Structured JSON logs to stdout per request.
- **Database (`mongo`)**: MongoDB 8.0 running on container port `27017` with persistent data stored in named volume `mongo-data`.

## Ports

| Service | Container Port | Host Port | Description |
| :--- | :--- | :--- | :--- |
| `shop-frontend` | `8080` | `3000` | Nginx web server & reverse proxy (public entrypoint) |
| `shop-backend` | `8080` | None (internal) | Express REST API server |
| `mongo` | `27017` | None (internal) | MongoDB database |

## Environment Variables

### Backend (`backend/.env.example`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port on which the Express server listens |
| `MONGO_URL` | `mongodb://mongo:27017/shopkart` | MongoDB connection URL |
| `NODE_ENV` | `production` | Node.js runtime environment |

### Frontend
| Variable | Default | Description |
| :--- | :--- | :--- |
| `API_TARGET` | `http://localhost:8080` | Target URL used by the Vite dev server proxy |

## How to Run with Docker Compose

1. **Build and start all services in the background**:
   ```bash
   docker compose up -d --build
   ```

2. **Check the status and health of the running containers**:
   ```bash
   docker compose ps
   ```

3. **Access the application**:
   - Web Application: [http://localhost:3000](http://localhost:3000)
   - API Health: [http://localhost:3000/api/products](http://localhost:3000/api/products)
   - Nginx Health: [http://localhost:3000/nginx-health](http://localhost:3000/nginx-health)

4. **View logs**:
   ```bash
   docker compose logs -f
   ```

5. **Stop and remove containers and volumes**:
   ```bash
   docker compose down -v
   ```

## How to Run Tests

### Backend Tests
The backend test suite mocks the Mongoose model and runs offline without requiring a database instance. It produces a coverage report in `backend/coverage/lcov.info`.

```bash
cd backend
npm install
npm test
npm run lint
```

### Frontend Tests
The frontend test suite uses Vitest and React Testing Library with mocked `fetch` calls. It produces a coverage report in `frontend/coverage/lcov.info`.

```bash
cd frontend
npm install
npm test
npm run lint
npm run build
```

