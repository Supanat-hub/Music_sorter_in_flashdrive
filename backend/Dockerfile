FROM python:3.11-slim

# Install system dependencies (ffmpeg is essential for yt-dlp audio extraction, nodejs for YouTube challenges)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set up user with UID 1000 (Hugging Face default requirement)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Install python dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy application source code
COPY --chown=user:user . .

# Expose default port
EXPOSE 7860

# Support dynamic PORT environment variable (e.g. Render uses $PORT, HuggingFace uses 7860)
ENV PORT=7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
