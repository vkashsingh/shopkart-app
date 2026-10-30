# Builds the ShopKart React single-page application and bundles it into an unprivileged Nginx web server.
# Serves static assets on port 8080 and proxies backend API traffic to http://shop-backend:8080.

# Stage 1: Build environment for transpiling and bundling the React application
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Compile React source code into optimized production assets in /app/dist
RUN npm run build

# Stage 2: Production web server using official unprivileged Nginx image
FROM nginxinc/nginx-unprivileged:1.30-alpine
# Temporarily elevate to root to patch base OS packages with latest Alpine security updates
USER root
RUN apk upgrade --no-cache
# Revert to unprivileged numeric user 101 required for Kubernetes runAsNonRoot compliance
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

# Exec form CMD runs Nginx in the foreground as PID 1 to properly capture process termination signals
CMD ["nginx", "-g", "daemon off;"]
