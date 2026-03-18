FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Args required at build-time by Vite
ARG VITE_API_BASE_URL
ARG VITE_APP_NAME

# Build for production
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copy built code to NGINX HTML folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
