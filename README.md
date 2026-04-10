# GoMobites - Multi-tenant SaaS Platform for Restaurants

A comprehensive SaaS platform for restaurant operations including:

- **Menu Management** - Digital menus with multi-tenant isolation
- **Order Management** - Real-time order processing and kitchen display
- **Multi-tenancy** - Complete data isolation with PostgreSQL RLS
- **Real-time Updates** - WebSocket-based live notifications

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL with Row-Level Security (RLS) |
| Backend | Node.js + Express + Socket.io |
| Consumer App | Next.js (React) - Mobile-first menu |
| Operator Dashboard | React + Vite - Kitchen display system |
| Reverse Proxy | Nginx |
| Container Orchestration | Docker Compose |

## Project Structure

```
gomobites/
├── db/                      # PostgreSQL schema with RLS policies
│   └── schema.sql          # Multi-tenant database structure
├── backend/                 # Node.js Express API server
│   ├── src/
│   │   └── server.ts       # Main API with WebSocket handler
│   ├── Dockerfile
│   └── package.json
├── apps/
│   ├── consumer/           # Next.js consumer application
│   │   ├── app/
│   │   │   └── menu/[slug]/page.tsx  # Menu page with ordering
│   │   └── Dockerfile
│   └── operator/           # React operator dashboard
│       ├── src/
│       │   └── App.tsx     # Kitchen display system
│       └── Dockerfile
├── docker-compose.yml       # Local development orchestration
└── nginx.conf              # Reverse proxy configuration
```

## Quick Start - Using Docker Compose

### Prerequisites
- Docker & Docker Compose installed
- Windows, macOS, or Linux

### 1. Clone & Navigate
```bash
cd c:\Users\srees\OneDrive\Projects\GoMobites
```

### 2. Start All Services
```bash
docker-compose up --build
```

This will:
- ✅ Initialize PostgreSQL database with schema
- ✅ Start Node.js backend API on `http://localhost:3001`
- ✅ Start Next.js consumer app on `http://localhost:3002`
- ✅ Start React operator dashboard on `http://localhost:3003`
- ✅ Expose database on `localhost:5432`

### 3. Access the Applications

| Application | URL | Purpose |
|------------|-----|---------|
| **Customer Menu** | http://localhost:3002/menu/demo | Order food |
| **Operator Dashboard** | http://localhost:3003 | Kitchen display & order management |
| **API** | http://localhost:3001/api/v1 | REST endpoints |
| **Database** | localhost:5432 | PostgreSQL (admin: postgres, pass: gomobites_pass) |

## API Endpoints

### Public Routes
```bash
# Get menu for a tenant
GET /api/v1/tenant/{slug}/menu

# Create an order
POST /api/v1/orders
{
  "tableNumber": "5A",
  "orderType": "dine-in",
  "items": [
    { "id": "item-uuid", "quantity": 2 }
  ]
}
```

### Protected Routes (requires JWT token)
```bash
# Get all orders
GET /api/v1/orders

# Get single order
GET /api/v1/orders/{orderId}

# Update order status
PATCH /api/v1/orders/{orderId}/status
{ "status": "preparing|ready|completed" }
```

## WebSocket Events

### Client → Server
- `connect` - Authenticate with JWT token in `auth.token`

### Server → Client
- `new_order` - New order received
- `order_status_updated` - Order status changed

## Database Features

### Multi-Tenancy with RLS (Row-Level Security)
- Each tenant's data is completely isolated
- PostgreSQL policies enforce isolation at the database level
- RLS context set via `app.current_tenant_id` session variable

### Tables
- `tenants` - Restaurant configurations
- `users` - Staff accounts with roles (owner, manager, staff)
- `menu_categories` - Categorized menu sections
- `menu_items` - Individual menu items with prices
- `tenant_tax_rates` - Tenant-specific tax configurations
- `orders` - Order records with tax calculations
- `order_items` - Order line items with snapshots

## Development Workflow

### Run Services Individually

#### Backend Only
```bash
cd backend
npm install
npm run dev
```

#### Consumer App
```bash
cd apps/consumer
npm install
npm run dev
# Runs on http://localhost:3000
```

#### Operator Dashboard
```bash
cd apps/operator
npm install
npm run dev
# Runs on http://localhost:5173
```

### Environment Variables

**Backend** (`.env`):
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/gomobites
JWT_SECRET=your-secret-key
PORT=3001
```

**Consumer** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

**Operator** (`.env`):
```
REACT_APP_API_URL=http://localhost:3001/api/v1
REACT_APP_WS_URL=http://localhost:3001
```

## Features Implemented

### ✅ Core Features
- [x] Multi-tenant data isolation with RLS
- [x] Menu management and display
- [x] Order creation with server-side price validation
- [x] Real-time order notifications (WebSocket)
- [x] Kitchen display system with status tracking
- [x] Tax calculation (inclusive & exclusive modes)
- [x] Database connection pooling

### ✅ Security
- [x] JWT authentication
- [x] Row-Level Security (RLS) policies
- [x] CORS configuration
- [x] Server-side price validation
- [x] Rate limiting on order endpoints

### ✅ Performance
- [x] Database indexes on frequently queried columns
- [x] Connection pooling
- [x] Optimistic UI updates
- [x] WebSocket for real-time updates

## Database Schema

### Tenants Management
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(3) CHECK (currency IN ('USD', 'PKR')),
    tax_inclusive BOOLEAN DEFAULT FALSE,
    payment_mode VARCHAR(20)
);
```

### Orders with Tax
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    table_number VARCHAR(20),
    order_type VARCHAR(20) CHECK (order_type IN ('dine-in', 'pickup')),
    subtotal INTEGER,      -- Base amount before tax
    total_tax INTEGER,     -- Calculated tax amount
    grand_total INTEGER,   -- Final amount
    status VARCHAR(20) DEFAULT 'new'
);
```

## Testing

### Create Test Data
The database automatically seeds a demo tenant with sample menu items:

```sql
-- Demo Tenant
- Slug: "demo"
- Name: "Demo Restaurant"
- Currency: PKR
- Menu: Samosas, Chicken Biryani, Mango Lassi
- Tax Rate: 18% GST
```

Access it at: http://localhost:3002/menu/demo

### Test Order Flow
1. Open consumer app and browse menu
2. Add items to cart
3. Place order
4. Watch operator dashboard for real-time update
5. Change order status from "new" → "preparing" → "ready" → "completed"

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port
# On Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View logs
docker-compose logs db
```

### Consumer App Not Loading
```bash
# Clear .next cache
rm -rf apps/consumer/.next

# Rebuild
docker-compose down
docker-compose up --build
```

## Production Deployment

For production, modify:

1. **docker-compose.yml**: Remove volume mounts and dev commands
2. **nginx.conf**: Add SSL certificates, enable HTTPS redirects
3. **.env files**: Update secrets, use environment-specific configs
4. **Database**: Use managed PostgreSQL service (AWS RDS, Azure Database)

Example production start:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## License

Proprietary - GoMobites SaaS Platform

## Support

For issues or questions, refer to the API specification or Database schema files.
