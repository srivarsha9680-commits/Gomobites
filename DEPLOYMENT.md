# GoMobites - Deployment Guide

## Quick Start with Docker Compose

### System Requirements
- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)
- 4GB RAM minimum
- 20GB free disk space

### Step 1: Start All Services
```bash
cd c:\Users\srees\OneDrive\Projects\GoMobites
docker-compose up --build
```

On first run, this will:
- Build all application images
- Create PostgreSQL database with schema
- Initialize sample data (demo restaurant with menu)
- Start all services

### Step 2: Verify Services are Running

Check that all containers are healthy:
```bash
docker-compose ps
```

You should see all services with status "Up" or "healthy".

### Step 3: Access Applications

#### 🍽️ Customer Menu (Next.js App)
- **URL**: http://localhost:3002/menu/demo
- **Purpose**: Customers browse menu and place orders
- **Demo Data**: Restaurant with categories (Appetizers, Main Courses, etc.)

#### 👨‍💼 Operator Dashboard (React App)
- **URL**: http://localhost:3003
- **Purpose**: Kitchen staff view orders in real-time
- **Features**: 
  - Live order notifications
  - Status tracking (New → Preparing → Ready → Completed)
  - Order totals and details

#### 🔌 API Server
- **URL**: http://localhost:3001/api/v1
- **Health Check**: http://localhost:3001/health
- **WebSocket**: ws://localhost:3001/socket.io

#### 🗄️ Database
- **Host**: localhost
- **Port**: 5432
- **Database**: gomobites
- **User**: postgres
- **Password**: gomobites_pass

### Step 4: Test the System

#### Using Browser:
1. Open **http://localhost:3002/menu/demo**
2. Add items to cart (Samosas, Biryani, etc.)
3. Click "Place Order"
4. Switch to **http://localhost:3003** (operator dashboard)
5. Watch new order appear with alert
6. Click "Start Preparing" → "Mark Ready" → "Completed"

#### Using cURL:
```bash
# Get menu
curl http://localhost:3001/api/v1/tenant/demo/menu

# Create order
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": "5A",
    "orderType": "dine-in",
    "items": [
      {"id": "<item-uuid>", "quantity": 2}
    ]
  }'

# Get orders
curl http://localhost:3001/api/v1/orders
```

## Useful Docker Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f db
docker-compose logs -f consumer_app
docker-compose logs -f operator_app
```

### Stop All Services
```bash
docker-compose down
```

### Remove Volumes (Reset Database)
```bash
docker-compose down -v
# Then restart: docker-compose up
```

### Rebuild Without Cache
```bash
docker-compose build --no-cache
docker-compose up
```

### Access Database Directly
```bash
# Using psql (if installed)
psql -h localhost -U postgres -d gomobites

# Using Docker
docker-compose exec db psql -U postgres -d gomobites
```

## Troubleshooting

### Issue: Port Already in Use
```bash
# Find and kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Or just change docker-compose port mappings
```

### Issue: Database Won't Start
```bash
# Check logs
docker-compose logs db

# Reset database volume
docker-compose down -v
docker-compose up
```

### Issue: WebSocket Connection Failed
- Check backend is running: `curl http://localhost:3001/health`
- Browser console should show "Connected to Kitchen Display"
- Check docker logs: `docker-compose logs backend`

### Issue: Menu Not Loading
```bash
# Backend might not be ready yet, wait 10-15 seconds
# Then refresh browser

# Check backend logs
docker-compose logs backend
```

## Testing Data

### Sample Restaurant (Auto-seeded)
**Slug**: `demo`
**Currency**: PKR
**Tax**: 18% GST (not inclusive)

**Menu Items**:
- Samosas (4pcs) - Rs. 300
- Chicken Biryani - Rs. 650
- Mango Lassi - Rs. 200

### Test Scenarios

**Scenario 1: Simple Order**
1. Open menu
2. Add 1x Biryani
3. Total: Rs. 650 + 18% tax = Rs. 767

**Scenario 2: Multiple Items**
1. Add 2x Samosas, 1x Biryani, 1x Lassi
2. Subtotal: 600 + 650 + 200 = Rs. 1450
3. Total with 18% tax: Rs. 1,711

**Scenario 3: Real-time Notifications**
1. Place order in consumer app
2. Check operator dashboard immediately
3. Should see NEW order with alert
4. Update status in real-time

## Environment Variables

Edit `.env` files to customize:

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://postgres:gomobites_pass@db:5432/gomobites
JWT_SECRET=your_jwt_secret_here
PORT=3001
CORS_ORIGIN=*
```

### Consumer (`apps/consumer/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### Operator (`apps/operator/.env`)
```
REACT_APP_API_URL=http://localhost:3001/api/v1
REACT_APP_WS_URL=http://localhost:3001
```

Then restart services:
```bash
docker-compose down
docker-compose up --build
```

## Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Use managed PostgreSQL database
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure production environment variables
- [ ] Set CORS_ORIGIN to specific domains
- [ ] Enable database backups
- [ ] Configure monitoring and logging
- [ ] Test with production data volume
- [ ] Set up CI/CD pipeline

See README.md for full production deployment guide.
