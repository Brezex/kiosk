# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --silent

COPY . .
RUN npm run build

# Production stage — пустой, статика копируется в backend
FROM scratch
COPY --from=builder /app/dist /dist