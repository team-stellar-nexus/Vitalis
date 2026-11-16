# Backend image: FastAPI + PyTorch (CPU). Build from the repo root:  docker build -t vitalis-api .
FROM python:3.12-slim
WORKDIR /app

COPY requirements-api.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements-api.txt

COPY src ./src
COPY artifacts ./artifacts

# run as a non-root user
RUN useradd --create-home --uid 10001 app
USER app

ENV PORT=8000
ENV DISABLE_DOCS=1
EXPOSE 8000
# CORS_ORIGINS must be set on the host, e.g. https://yourdomain.com,https://www.yourdomain.com
CMD ["sh", "-c", "python -m uvicorn api:app --app-dir src --host 0.0.0.0 --port ${PORT}"]
