# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build
RUN npm run build

# Stage 2: Backend + frontend
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TERM=xterm
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV DATABASE_URL=sqlite:///./data/zabbix_kiosk.db
ENV SECRET_KEY=change-this-in-production-very-secret-key-min-32-chars
ENV PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc curl && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p /app/data

WORKDIR /app/backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]