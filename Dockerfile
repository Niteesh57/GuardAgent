# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the Next.js frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (layer-cache friendly)
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
# NEXT_PUBLIC_API_URL is baked into the JS bundle at build time.
# Set it via Railway build variable: NEXT_PUBLIC_API_URL=https://your-railway-domain.up.railway.app
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_AUTH0_DOMAIN=""
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID=""
ARG NEXT_PUBLIC_AUTH0_AUDIENCE=""

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID
ENV NEXT_PUBLIC_AUTH0_AUDIENCE=$NEXT_PUBLIC_AUTH0_AUDIENCE

COPY frontend/ ./
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Final image — Python + Node + supervisord
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS final

# Install Node.js (for running Next.js) and supervisord
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Backend ────────────────────────────────────────────────────────────────
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/

# ── Frontend (built output from stage 1) ──────────────────────────────────
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# ── Supervisord config ────────────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/app.conf

# Ensure logs directory exists for backend
RUN mkdir -p /app/backend/logs

# ── Ports ─────────────────────────────────────────────────────────────────
# Railway expects a single PORT env var. We expose 3000 (Next.js) as the
# public-facing port. The backend runs internally on 8000.
EXPOSE 3000 8000

# ── Start both services via supervisord ───────────────────────────────────
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/app.conf"]
