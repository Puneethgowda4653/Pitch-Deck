#!/bin/bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 iPreneur Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Check prerequisites ───────────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ $1 is required but not installed. Please install it first."
    exit 1
  fi
  echo -e "${GREEN}✓${NC} $1 found"
}

echo "Checking prerequisites..."
check_cmd docker
check_cmd docker-compose
check_cmd node
check_cmd python3

echo ""

# ── Environment files ─────────────────────────────────────────────────────────
echo "Setting up environment files..."

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo -e "${YELLOW}⚠️  Created backend/.env — please add your ANTHROPIC_API_KEY${NC}"
fi

if [ ! -f frontend/.env ]; then
  echo "VITE_API_URL=http://localhost:8000/api/v1" > frontend/.env
  echo "VITE_WS_URL=ws://localhost:8000" >> frontend/.env
  echo -e "${GREEN}✓${NC} Created frontend/.env"
fi

# ── Install frontend dependencies ─────────────────────────────────────────────
echo ""
echo "Installing frontend dependencies..."
cd frontend && npm install --silent && cd ..
echo -e "${GREEN}✓${NC} Frontend dependencies installed"

# ── Start infrastructure ──────────────────────────────────────────────────────
echo ""
echo "Starting Docker services (postgres, redis, minio)..."
docker-compose up -d postgres redis minio
echo "Waiting for services to be healthy..."
sleep 5

# ── Run migrations ────────────────────────────────────────────────────────────
echo ""
echo "Running database migrations..."
cd backend
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
# alembic upgrade head  # Uncomment when migrations are set up
python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')
from app.db.session import init_db
asyncio.run(init_db())
print('✓ Database initialized')
"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Add ANTHROPIC_API_KEY to backend/.env"
echo "  2. Start backend:  cd backend && uvicorn app.main:app --reload"
echo "  3. Start frontend: cd frontend && npm run dev"
echo "  4. Open: http://localhost:3000"
echo ""
