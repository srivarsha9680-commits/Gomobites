/// <reference types="vite/client" />

import React, { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import './App.css';

interface Order {
    id: string;
    table_number: string;
    grand_total: number;
    currency: string;
    status: string;
    created_at: string;
    subtotal: number;
    total_tax: number;
}

const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3001';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState({ new: 0, preparing: 0, ready: 0, completed: 0 });
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

    const consumerMenuUrl = import.meta.env.VITE_CONSUMER_URL || 'http://localhost:3000';
    const qrTargets = [
        { id: 'pickup', label: 'Pickup', value: 'pickup' },
        { id: 't1', label: 'Table T1', value: 'T1' },
        { id: 't2', label: 'Table T2', value: 'T2' },
        { id: 't3', label: 'Table T3', value: 'T3' },
    ];

    const generateQRCodes = async () => {
        const codes: Record<string, string> = {};
        for (const target of qrTargets) {
            const url = `${consumerMenuUrl}/menu/demo?table=${encodeURIComponent(target.value)}`;
            codes[target.id] = await QRCode.toDataURL(url, { margin: 1, width: 200 });
        }
        setQrCodes(codes);
    };

    const openQrModal = async () => {
        setQrModalOpen(true);
        if (Object.keys(qrCodes).length === 0) {
            await generateQRCodes();
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');

        // For demo purposes, accept demo credentials
        if ((username === 'admin' && password === 'admin') ||
            (username === 'manager' && password === 'manager')) {
            localStorage.setItem('jwt', 'mock_token_for_demo');
            setIsLoggedIn(true);
            initializeDashboard('mock_token_for_demo');
            return;
        }

        // Try actual login (will fallback to demo if backend doesn't have auth endpoint)
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('jwt', data.token);
                setIsLoggedIn(true);
                initializeDashboard(data.token);
            } else {
                setLoginError('Invalid credentials. Try demo credentials.');
            }
        } catch (error) {
            setLoginError('Login failed. Using demo mode...');
            // Fallback to demo mode
            localStorage.setItem('jwt', 'mock_token_for_demo');
            setIsLoggedIn(true);
            initializeDashboard('mock_token_for_demo');
        }
    };

    const initializeDashboard = (token: string) => {
        const newSocket = io(wsUrl, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        newSocket.on('connect', () => {
            console.log('✅ Connected to server');
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            setConnected(false);
        });

        newSocket.on('connect_error', (error: Error) => {
            console.error('Socket connect error:', error.message);
            setConnected(false);
        });

        newSocket.on('new_order', (newOrder: Order) => {
            console.log('🎉 New order:', newOrder);
            // Play notification sound
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==');
            audio.play().catch(() => { });

            setOrders(prev => {
                const nextOrders = [newOrder, ...prev];
                updateStats(nextOrders);
                return nextOrders;
            });
        });

        newSocket.on('order_status_updated', (data: { orderId: string; status: string }) => {
            console.log('📊 Order updated:', data);
            setOrders(prev =>
                prev.map(o => o.id === data.orderId ? { ...o, status: data.status } : o)
            );
        });

        setSocket(newSocket);

        // Fetch initial orders
        fetchOrders(token);
    };

    const fetchOrders = async (token: string) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
            const response = await fetch(`${apiUrl}/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setOrders(data.orders || []);
                updateStats(data.orders || []);
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        }
    };

    const updateStats = (orderList: Order[]) => {
        setStats({
            new: orderList.filter(o => o.status === 'new').length,
            preparing: orderList.filter(o => o.status === 'preparing').length,
            ready: orderList.filter(o => o.status === 'ready').length,
            completed: orderList.filter(o => o.status === 'completed').length,
        });
    };

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            const token = localStorage.getItem('jwt') || 'mock_token_for_demo';
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
            const response = await fetch(`${apiUrl}/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                setOrders(prev =>
                    prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
                );
                updateStats(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            }
        } catch (error) {
            console.error('Failed to update order:', error);
            alert('Error updating order');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('jwt');
        setIsLoggedIn(false);
        setOrders([]);
        setStats({ new: 0, preparing: 0, ready: 0, completed: 0 });
        if (socket) {
            socket.disconnect();
        }
    };

    const getOrdersByStatus = (status: string) => {
        return orders.filter(o => o.status === status).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    };

    const statusColumns = ['new', 'preparing', 'ready', 'completed'];
    const statusLabels = { new: 'New Orders', preparing: 'Preparing', ready: 'Ready for Pickup', completed: 'Completed' };
    const statusColors = { new: '#ff4444', preparing: '#ffaa00', ready: '#00bb00', completed: '#666' };

    // Check if already logged in
    useEffect(() => {
        const token = localStorage.getItem('jwt');
        if (token) {
            setIsLoggedIn(true);
            initializeDashboard(token);
        }
    }, []);

    if (!isLoggedIn) {
        return (
            <div className="login-container">
                <div className="login-form">
                    <h1>🍽️ GoMobites Operator Login</h1>
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                            />
                        </div>
                        {loginError && <div className="error-message">{loginError}</div>}
                        <button type="submit" className="login-btn">Login</button>
                    </form>
                    <div className="demo-info">
                        <p><strong>Demo Credentials:</strong></p>
                        <p>Username: <code>admin</code> | Password: <code>admin</code></p>
                        <p>Username: <code>manager</code> | Password: <code>manager</code></p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="header">
                <h1>🍽️ GoMobites - Kitchen Display System</h1>
                <div className="header-right">
                    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                        {connected ? '✅ Live' : '⚠️ Offline'}
                    </div>
                    <button className="btn btn-outline" onClick={openQrModal}>QR Codes</button>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </header>

            <div className="stats-bar">
                <div className="stat">
                    <span className="stat-label">New Orders</span>
                    <span className="stat-value new">{stats.new}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Preparing</span>
                    <span className="stat-value preparing">{stats.preparing}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Ready</span>
                    <span className="stat-value ready">{stats.ready}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Completed</span>
                    <span className="stat-value completed">{stats.completed}</span>
                </div>
            </div>

            {qrModalOpen && (
                <div className="modal-overlay" onClick={() => setQrModalOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>QR Codes</h2>
                            <button className="close-btn" onClick={() => setQrModalOpen(false)}>&times;</button>
                        </div>
                        <p className="modal-subtitle">Scan any code below to open the menu for that table.</p>
                        <div className="qr-grid">
                            {qrTargets.map(target => (
                                <div key={target.id} className="qr-card">
                                    {qrCodes[target.id] ? (
                                        <img className="qr-image" src={qrCodes[target.id]} alt={`${target.label} QR`} />
                                    ) : (
                                        <div className="qr-loading">Generating...</div>
                                    )}
                                    <div className="qr-label">{target.label}</div>
                                    <div className="qr-url">{`${consumerMenuUrl}/menu/demo?table=${encodeURIComponent(target.value)}`}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <main className="dashboard">
                {statusColumns.map(status => (
                    <div key={status} className="column">
                        <div className="column-header" style={{ borderColor: statusColors[status as keyof typeof statusColors] }}>
                            <h2>{statusLabels[status as keyof typeof statusLabels]}</h2>
                            <span className="count">{getOrdersByStatus(status).length}</span>
                        </div>

                        <div className="cards">
                            {getOrdersByStatus(status).length === 0 ? (
                                <div className="empty-state">No {status} orders</div>
                            ) : (
                                getOrdersByStatus(status).map(order => (
                                    <div
                                        key={order.id}
                                        className="order-card"
                                        style={{ borderLeftColor: statusColors[status as keyof typeof statusColors] }}
                                    >
                                        <div className="order-header">
                                            <span className="table-label">TABLE {order.table_number}</span>
                                            <span className="time">
                                                {new Date(order.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        <div className="order-total">
                                            <strong>{order.currency || 'PKR'} {(order.grand_total / 100).toFixed(2)}</strong>
                                            {order.subtotal > 0 && (
                                                <small>
                                                    Subtotal: {order.currency || 'PKR'} {(order.subtotal / 100).toFixed(2)}
                                                    {order.total_tax > 0 && ` + Tax: ${(order.total_tax / 100).toFixed(2)}`}
                                                </small>
                                            )}
                                        </div>

                                        <div className="order-actions">
                                            {status === 'new' && (
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                >
                                                    Start Preparing
                                                </button>
                                            )}
                                            {status === 'preparing' && (
                                                <button
                                                    className="btn btn-success"
                                                    onClick={() => updateOrderStatus(order.id, 'ready')}
                                                >
                                                    Mark Ready
                                                </button>
                                            )}
                                            {status === 'ready' && (
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => updateOrderStatus(order.id, 'completed')}
                                                >
                                                    Completed
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
}

export default App;