FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt requirements-timesfm.txt ./
ARG INSTALL_TIMESFM=false
RUN if [ "$INSTALL_TIMESFM" = "true" ]; then pip install --no-cache-dir -r requirements-timesfm.txt; else pip install --no-cache-dir -r requirements.txt; fi
COPY . .
ENV PORT=8080
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]

