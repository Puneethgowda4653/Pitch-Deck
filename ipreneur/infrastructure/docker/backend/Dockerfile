FROM python:3.11-slim

WORKDIR /app

# System dependencies for Playwright and python-pptx
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    wget \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-unifont \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies (pinned playwright ensures browser version stays in sync)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN useradd -m -u 1001 appuser \
    && mkdir -p /home/appuser/.cache/ms-playwright \
    && chown -R appuser:appuser /home/appuser

# Install browser binaries as appuser so paths match at runtime
ENV PLAYWRIGHT_BROWSERS_PATH=/home/appuser/.cache/ms-playwright
RUN su appuser -c "PLAYWRIGHT_BROWSERS_PATH=/home/appuser/.cache/ms-playwright python -m playwright install chromium" \
    && ls /home/appuser/.cache/ms-playwright

# Copy application code
COPY . .
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
