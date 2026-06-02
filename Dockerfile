# Stage 1: Build the static site
FROM node:24-alpine AS builder
WORKDIR /app

# Install dependencies first (caching optimization)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Run static site compilation
RUN npm run build

# Stage 2: Serve with a production-grade lightweight server
FROM nginx:alpine

# Copy Astro build output to nginx document root
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose Nginx default HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
