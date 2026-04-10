import express, { Request, Response, NextFunction } from 'express';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

// Type definitions
interface MenuCategory {
    id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    items?: MenuItem[];
}

interface MenuItem {
    id: string;
    category_id: string;
    name: string;
    description: string;
    price: number;
    image_url?: string;
    is_available: boolean;
}

interface TaxRate {
    name: string;
    rate: string;
}

interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    instructions: string;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ['GET', 'POST', 'PATCH']
    }
});

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            context?: {
                tenantId: string;
            };
        }
    }
}

// Middleware
app.use(cors());
app.use(express.json());

// Middleware: Tenant Context & RLS Injection
const setTenantContext = async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();

    try {
        const tenantSlug = req.params.slug;
        const authHeader = req.headers.authorization;

        let tenantId: string | undefined;

        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { tenantId: string };
                tenantId = decoded.tenantId;
            } catch (e) {
                client.release();
                res.status(401).json({ error: 'Invalid token' });
                return;
            }
        } else if (tenantSlug) {
            const result = await client.query('SELECT id FROM tenants WHERE slug = $1', [tenantSlug]);
            if (result.rows.length) tenantId = result.rows[0].id;
        }

        if (tenantId) {
            await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
            (req as any).pgClient = client;
            req.context = { tenantId };
        } else {
            client.release();
        }

        next();
    } catch (error) {
        client.release();
        next(error);
    }
};

// Cleanup middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        const client = (req as any).pgClient;
        if (client) client.release();
    });
    next();
});

// Health Check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- PUBLIC ROUTES ---

// Get Menu for Consumer App
app.get('/api/v1/tenant/:slug/menu', setTenantContext, async (req: Request, res: Response) => {
    const client = (req as any).pgClient || await pool.connect();

    try {
        if (!req.context?.tenantId) throw new Error('Tenant context missing');

        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [req.context.tenantId]);

        const configRes = await client.query(
            'SELECT currency, tax_inclusive FROM tenants WHERE id = $1',
            [req.context.tenantId]
        );

        const categoriesRes = await client.query(
            'SELECT * FROM menu_categories WHERE is_active = true ORDER BY sort_order'
        );

        const itemsRes = await client.query(
            'SELECT id, category_id, name, description, price, image_url, is_available FROM menu_items WHERE is_available = true'
        );

        const menu = categoriesRes.rows.map((cat: any) => ({
            ...cat,
            items: itemsRes.rows.filter((item: any) => item.category_id === cat.id)
        }));

        res.json({
            success: true,
            data: menu,
            config: configRes.rows[0]
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } finally {
        if (!((req as any).pgClient)) client.release();
    }
});

// --- ORDER CREATION (Critical Logic) ---
app.post('/api/v1/tenant/:slug/orders', setTenantContext, async (req: Request, res: Response) => {
    const client = (req as any).pgClient;
    const { items, tableNumber, orderType, specialInstructions } = req.body as {
        items: Array<{ id: string; quantity: number; instructions?: string }>;
        tableNumber: string;
        orderType: string;
        specialInstructions?: string;
    };

    if (!client) {
        res.status(500).json({ error: 'Database connection failed' });
        return;
    }

    try {
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('Order items are required');
        }

        if (!tableNumber) {
            throw new Error('Table number is required');
        }

        if (!orderType) {
            throw new Error('Order type is required');
        }

        await client.query('BEGIN');

        if (!req.context?.tenantId) throw new Error('Tenant context missing');
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [req.context.tenantId]);
        const configRes = await client.query(
            'SELECT currency, tax_inclusive FROM tenants WHERE id = $1',
            [req.context.tenantId]
        );
        const { currency, tax_inclusive } = configRes.rows[0];

        // 2. Fetch Tax Rates
        const taxRes = await client.query(
            'SELECT name, rate FROM tenant_tax_rates WHERE is_active = true'
        );
        const taxRates = taxRes.rows;

        // 3. Calculate Totals (Server-Side Authority)
        let subtotal = 0;
        let totalTax = 0;
        const orderItems = [];

        for (const item of items) {
            const itemRes = await client.query(
                'SELECT price, name FROM menu_items WHERE id = $1',
                [item.id]
            );

            if (itemRes.rows.length === 0) throw new Error(`Item ${item.id} not found`);

            const dbItem = itemRes.rows[0];
            const itemTotal = dbItem.price * item.quantity;

            let itemTax = 0;
            if (tax_inclusive) {
                const effectiveRate = taxRates.reduce((acc: number, t: any) => acc + parseFloat(t.rate), 0);
                const basePrice = Math.round(itemTotal / (1 + effectiveRate));
                itemTax = itemTotal - basePrice;
            } else {
                const effectiveRate = taxRates.reduce((acc: number, t: any) => acc + parseFloat(t.rate), 0);
                itemTax = Math.round(itemTotal * effectiveRate);
            }

            subtotal += itemTotal;
            totalTax += itemTax;

            orderItems.push({
                id: item.id,
                name: dbItem.name,
                quantity: item.quantity,
                unit_price: dbItem.price,
                instructions: item.instructions || ''
            });
        }

        const grandTotal = tax_inclusive ? subtotal : subtotal + totalTax;

        // 4. Insert Order
        const orderInsert = await client.query(
            `INSERT INTO orders (tenant_id, table_number, order_type, subtotal, total_tax, grand_total, status, special_instructions) 
       VALUES ($1, $2, $3, $4, $5, $6, 'new', $7) RETURNING id, created_at`,
            [req.context.tenantId, tableNumber, orderType, subtotal, totalTax, grandTotal, specialInstructions || '']
        );

        const orderId = orderInsert.rows[0].id;

        // 5. Insert Order Items
        for (const oi of orderItems) {
            await client.query(
                `INSERT INTO order_items (order_id, menu_item_id, name_snapshot, quantity, unit_price, special_instructions) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [orderId, oi.id, oi.name, oi.quantity, oi.unit_price, oi.instructions]
            );
        }

        await client.query('COMMIT');

        // 6. Notify Operator Dashboard via WebSocket
        io.to(req.context.tenantId).emit('new_order', {
            id: orderId,
            tableNumber,
            grandTotal,
            currency,
            status: 'new',
            createdAt: orderInsert.rows[0].created_at
        });

        res.status(201).json({
            success: true,
            orderId,
            grandTotal,
            currency,
            subtotal,
            totalTax
        });

    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

// Get Order Details
app.get('/api/v1/orders/:orderId', setTenantContext, async (req: Request, res: Response) => {
    const client = (req as any).pgClient || await pool.connect();

    try {
        if (!req.context?.tenantId) throw new Error('Tenant context missing');

        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [req.context.tenantId]);

        const orderRes = await client.query(
            'SELECT * FROM orders WHERE id = $1',
            [req.params.orderId]
        );

        if (orderRes.rows.length === 0) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const itemsRes = await client.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [req.params.orderId]
        );

        res.json({
            success: true,
            order: orderRes.rows[0],
            items: itemsRes.rows
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } finally {
        if (!((req as any).pgClient)) client.release();
    }
});

// Update Order Status
app.patch('/api/v1/orders/:orderId/status', setTenantContext, async (req: Request, res: Response) => {
    const client = (req as any).pgClient || await pool.connect();
    const { status } = req.body;

    try {
        if (!req.context?.tenantId) throw new Error('Tenant context missing');
        if (!status) throw new Error('Status is required');

        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [req.context.tenantId]);
        const result = await client.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.orderId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        // Broadcast update
        io.to(req.context.tenantId).emit('order_status_updated', {
            orderId: req.params.orderId,
            status
        });

        res.json({ success: true, order: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } finally {
        if (!((req as any).pgClient)) client.release();
    }
});

// Get all orders for a tenant
app.get('/api/v1/orders', setTenantContext, async (req: Request, res: Response) => {
    const client = (req as any).pgClient || await pool.connect();

    try {
        if (!req.context?.tenantId) throw new Error('Tenant context missing');

        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [req.context.tenantId]);

        const result = await client.query(
            'SELECT * FROM orders ORDER BY created_at DESC LIMIT 50'
        );

        res.json({ success: true, orders: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } finally {
        if (!((req as any).pgClient)) client.release();
    }
});

// --- WebSocket Authentication ---
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    if (token === 'mock_token_for_demo' && process.env.NODE_ENV !== 'production') {
        try {
            const result = await pool.query('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', ['demo']);
            if (result.rows.length === 0) throw new Error('Demo tenant not found');
            socket.data.tenantId = result.rows[0].id;
            return next();
        } catch (err) {
            return next(new Error('Authentication error'));
        }
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { tenantId: string };
        socket.data.tenantId = decoded.tenantId;
        next();
    } catch (e) {
        next(new Error('Authentication error'));
    }
});

io.on('connection', (socket) => {
    socket.join(socket.data.tenantId);
    console.log(`[WebSocket] Operator connected to tenant: ${socket.data.tenantId}`);

    socket.on('disconnect', () => {
        console.log(`[WebSocket] Operator disconnected from tenant: ${socket.data.tenantId}`);
    });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 GoMobites API running on port ${PORT}`);
    console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'local'}`);
});

export default app;
