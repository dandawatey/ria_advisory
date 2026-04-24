#!/bin/bash
# Start the UFIP FastAPI backend
# Usage: ./start.sh [--etl]   (--etl flag runs the ETL loader first)

set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "⚠  No .env file found. Copy .env.example → .env and set your Postgres credentials."
  exit 1
fi

if [ "$1" = "--etl" ]; then
  echo "Running ETL loader..."
  /Library/Developer/CommandLineTools/usr/bin/python3 etl/load_gl.py
fi

echo "Starting FastAPI on http://localhost:8000"
/Library/Developer/CommandLineTools/usr/bin/python3 -m uvicorn main:app --reload --port 8000
