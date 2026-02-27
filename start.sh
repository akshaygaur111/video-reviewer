#!/bin/bash
set -e

echo "🚀 VideoIQ — Starting development servers"
echo ""

# Check .env
if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env not found — copying from example"
  cp backend/.env.example backend/.env
  echo "   → Edit backend/.env and set GEMINI_API_KEY + ADMIN_EMAIL"
fi

# Install backend deps (venv)
if [ ! -d backend/.venv ]; then
  echo "📦 Creating Python venv..."
  python3 -m venv backend/.venv
fi
source backend/.venv/bin/activate
pip install -q -r backend/requirements.txt
echo "✅ Backend deps ready"

# Install frontend deps
if [ ! -d frontend/node_modules ]; then
  echo "📦 Installing frontend deps..."
  (cd frontend && npm install)
fi
echo "✅ Frontend deps ready"

echo ""
echo "Starting servers..."
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo "  API docs → http://localhost:8000/docs"
echo ""

# Run both concurrently
(cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
(cd frontend && npm run dev) &

wait
