# Production image — one container that builds the React app and serves it from
# FastAPI. Nothing but Docker required to run it:
#
#   docker build -t yahtzee .
#   docker run -p 8000:8000 -v yahtzee-data:/data yahtzee
#
# Then open http://localhost:8000

# ---- Stage 1: build the frontend ----
FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build          # -> /build/dist

# ---- Stage 2: backend + bundled frontend ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    YAHTZEE_DB_PATH=/data/yahtzee.db

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /build/dist ./app/static

VOLUME ["/data"]
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
