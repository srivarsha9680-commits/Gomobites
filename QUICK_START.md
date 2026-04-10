# 🚀 GoMobites Quick Start Guide

## ✅ Installation Complete!

Your complete GoMobites SaaS platform has been created at:
```
c:\Users\srees\OneDrive\Projects\GoMobites
```

## 📋 Prerequisites

You must have **Docker Desktop** installed and running:

### Install Docker Desktop
1. Download from: https://www.docker.com/products/docker-desktop
2. Install and launch Docker Desktop
3. Wait for Docker to fully start (check taskbar icon)

## 🎯 Quick Start (3 Steps)

### Step 1: Open PowerShell
```powershell
cd c:\Users\srees\OneDrive\Projects\GoMobites
```

### Step 2: Start All Services
```powershell
docker-compose up --build
```

This will:
- Build all application images
- Set up PostgreSQL database with sample data
- Start 4 services in containers

⏳ **First run takes 2-3 minutes** while images are built

### Step 3: Access Applications

Once you see `🚀 GoMobites API running on port 3001`, open your browser:

| Application | URL | Purpose |
|------------|-----|---------|
| **Customer Menu** | http://localhost:3002/menu/demo | Browse & order |
| **Operator Dashboard** | http://localhost:3003 | Kitchen display |
| **API** | http://localhost:3001/api/v1 | REST endpoints |
| **Health Check** | http://localhost:3001/health | API status |

## 🧪 Test the System

### Test Customer Ordering:
1. Open http://localhost:3002/menu/demo
2. Browse categories: "Appetizers", "Main Courses", "Beverages"
3. Click "Add +" to add items to cart
4. See instant total with tax calculation
5. Click "Place Order" button
6. You'll see order total and confirmation

### Test Kitchen Dashboard:
1. Open http://localhost:3003
2. Place an order from the consumer app
3. Watch new order appear in "New Orders" column
4. Click "Start Preparing" to move to next column
5. Click "Mark Ready"
6. Click "Completed" to finish

**What's Real-Time?** 📡
- When you place an order in the menu, it instantly appears in the dashboard
- Sound notification plays
- No page refresh needed - WebSocket handles updates

## 🐳 Docker Commands Reference

### View Logs
```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f consumer_app
docker-compose logs -f operator_app
```

### Stop Services
```powershell
docker-compose down
```

### Restart Services
```powershell
docker-compose restart backend
```

### Reset Database
```powershell
docker-compose down -v
docker-compose up
```

## 📊 Test Data (Auto-Loaded)

**Restaurant**: Demo
**Currency**: PKR (Pakistani Rupees)
**Tax**: 18% GST (Not Inclusive)

**Menu Items**:
- Samosas (4pcs) - Rs. 300
- Chicken Biryani - Rs. 650  
- Mango Lassi - Rs. 200

## 🔌 API Examples

### Get Menu
```bash
curl http://localhost:3001/api/v1/tenant/demo/menu
```

### Place Order
```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": "5A",
    "orderType": "dine-in",
    "items": [
      {"id": "item-uuid", "quantity": 2}
    ]
  }'
```

## 🔧 Troubleshooting

### "Docker daemon is not running"
**Solution**: Start Docker Desktop
- Windows: Search "Docker Desktop" in Start menu and launch it
- Wait for notification tray icon to appear
- Then run docker-compose again

### "Port 3001 already in use"
**Solution**: Stop other services using the port
```powershell
# Find process
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess

# Kill it
Stop-Process -id <PID> -Force
```

### "Containers won't start"
**Solution**: Check logs and reset
```powershell
docker-compose logs
docker-compose down -v
docker-compose up --build
```

### "Menu doesn't load"
**Solution**: Wait 15 seconds for backend to fully initialize, then refresh

## 📁 Project Structure

```
GoMobites/
├── db/
│   └── schema.sql              ← Database schema with 50+ sample records
├── backend/
│   ├── src/server.ts           ← Express API + WebSocket
│   └── Dockerfile
├── apps/
│   ├── consumer/               ← Next.js menu app
│   └── operator/               ← React kitchen display
├── docker-compose.yml          ← Orchestration config
└── README.md                   ← Full documentation
```

## 🎓 Architecture Highlights

### Multi-Tenancy with Row-Level Security
- Complete data isolation between restaurants
- PostgreSQL RLS enforces at database level
- One deployment supports unlimited restaurants
- Just add new tenant with `INSERT INTO tenants...`

### Real-Time Features
- Socket.io WebSocket for live updates
- Kitchen staff sees orders instantly
- No polling or page refreshes needed
- Automatic notifications with sound

### Tax Handling
- Server-side calculation (prevents fraud)
- Support for inclusive/exclusive tax modes
- Per-tenant tax rate configuration
- Itemized tax in order summary

### Security
- JWT authentication
- Server-side price validation
- Rate limiting on orders endpoint
- CORS configuration

## ✨ Feature Checklist

- ✅ Multi-tenant restaurant management
- ✅ Digital menu display
- ✅ Real-time orders
- ✅ Kitchen display system
- ✅ Tax calculations
- ✅ Multiple currencies (USD, PKR)
- ✅ Queue management
- ✅ Order history
- ✅ Real-time notifications
- ✅ WebSocket integration

## 📞 Support

For detailed docs, see:
- **README.md** - Complete system documentation
- **DEPLOYMENT.md** - Deployment guide
- **db/schema.sql** - Database reference

## 🎉 You're All Set!

Your production-ready SaaS platform is ready to use locally.

**Next Steps:**
1. ✅ Verify Docker Desktop is running
2. ✅ Run `docker-compose up --build`
3. ✅ Test the menu and dashboard
4. ✅ Review the API endpoints
5. ✅ Customize for your restaurant

**Questions?** Check the README.md in the project root!
