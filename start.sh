#!/bin/bash
# Start GoMobites Platform

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting GoMobites SaaS Platform...${NC}\n"

# Check if Docker is running
if ! docker ps &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker daemon is not running!${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Start services
echo -e "\n${BLUE}📦 Building and starting containers...${NC}\n"
docker-compose up --build

echo -e "\n${GREEN}✅ GoMobites is running!${NC}"
echo -e "\n${BLUE}Access your applications:${NC}"
echo -e "  🍽️  Menu:        ${YELLOW}http://localhost:3002/menu/demo${NC}"
echo -e "  👨‍💼 Dashboard:  ${YELLOW}http://localhost:3003${NC}"
echo -e "  🔌 API:        ${YELLOW}http://localhost:3001/api/v1${NC}"
echo -e "  🗄️  Database:    ${YELLOW}localhost:5432${NC} (user: postgres, pass: gomobites_pass)"
