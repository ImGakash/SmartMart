# Multi-stage production build for SmartMart

# Stage 1: Build the frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_USE_MOCKS=false
RUN npm run build

# Stage 2: Production Node.js runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install backend production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy backend application source
COPY backend/src ./backend/src
COPY shared ./shared

# Copy CA certificates if present in build context
COPY backend/ca.pem* ./backend/

# Copy built frontend assets for static serving or reverse proxying
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 4000

CMD ["node", "src/index.js"]
