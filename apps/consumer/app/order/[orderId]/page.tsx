'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useRef } from 'react';
import { useParams } from 'next/navigation';

interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
}

interface Order {
    id: string;
    table_number: string;
    grand_total: number;
    currency: string;
    status: string;
    created_at: string;
    subtotal: number;
    total_tax: number;
    items: OrderItem[];
}


export default function OrderTrackingPage() {
    const { orderId } = useParams();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    // Generate QR code for the order URL after order is loaded
    useEffect(() => {
        if (order && qrCanvasRef.current) {
            const url = typeof window !== 'undefined' ? window.location.href : '';
            QRCode.toCanvas(qrCanvasRef.current, url, { width: 180 }, function (error) {
                // Optionally handle error
            });
        }
    }, [order]);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                setLoading(true);
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
                const response = await fetch(`${apiUrl}/orders/${orderId}`);

                if (!response.ok) {
                    throw new Error('Order not found');
                }

                const data = await response.json();
                setOrder(data.order);
            } catch (err: any) {
                setError(err.message || 'Failed to load order');
            } finally {
                setLoading(false);
            }
        };

        if (orderId) {
            fetchOrder();
            <div style={{ marginTop: 24, textAlign: 'center' }}>
                <h3>Scan to view this order</h3>
                <canvas ref={qrCanvasRef} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
            </div>

            // Poll for updates every 10 seconds
            const interval = setInterval(fetchOrder, 10000);
            return () => clearInterval(interval);
        }
    }, [orderId]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return '#ffaa00';
            case 'preparing': return '#ffaa00';
            case 'ready': return '#00bb00';
            case 'completed': return '#666';
            default: return '#666';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'new': return 'Order Received';
            case 'preparing': return 'Preparing';
            case 'ready': return 'Ready for Pickup';
            case 'completed': return 'Completed';
            default: return status;
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loadingContainer}>
                    <div style={styles.spinner}></div>
                    <p>Loading order status...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.errorContainer}>
                    <h1>❌ Order Not Found</h1>
                    <p>{error}</p>
                    <p>Order ID: {orderId}</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div style={styles.container}>
                <div style={styles.errorContainer}>
                    <h1>❌ Order Not Found</h1>
                    <p>Unable to find order with ID: {orderId}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1>🍽️ Order Tracking</h1>
                <p>Order #{order.id}</p>
            </div>

            <div style={styles.content}>
                <div style={styles.statusCard}>
                    <h2>Current Status</h2>
                    <div style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusColor(order.status)
                    }}>
                        {getStatusText(order.status)}
                    </div>
                    <p style={styles.statusTime}>
                        Ordered at: {new Date(order.created_at).toLocaleString()}
                    </p>
                </div>

                <div style={styles.detailsCard}>
                    <h2>Order Details</h2>
                    <div style={styles.detailRow}>
                        <span>Table:</span>
                        <strong>{order.table_number}</strong>
                    </div>
                    <div style={styles.detailRow}>
                        <span>Items:</span>
                        <strong>{order.items?.length || 0}</strong>
                    </div>
                    <div style={styles.detailRow}>
                        <span>Subtotal:</span>
                        <strong>{order.currency || 'PKR'} {(order.subtotal / 100).toFixed(2)}</strong>
                    </div>
                    {order.total_tax > 0 && (
                        <div style={styles.detailRow}>
                            <span>Tax:</span>
                            <strong>{order.currency || 'PKR'} {(order.total_tax / 100).toFixed(2)}</strong>
                        </div>
                    )}
                    <div style={{ ...styles.detailRow, ...styles.totalRow }}>
                        <span>Total:</span>
                        <strong>{order.currency || 'PKR'} {(order.grand_total / 100).toFixed(2)}</strong>
                    </div>
                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                        <h3>Scan to view this order</h3>
                        <canvas ref={qrCanvasRef} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
                    </div>
                </div>

                {order.items && order.items.length > 0 && (
                    <div style={styles.itemsCard}>
                        <h2>Items Ordered</h2>
                        {order.items.map((item, index) => (
                            <div key={index} style={styles.itemRow}>
                                <span>{item.name}</span>
                                <span>×{item.quantity}</span>
                                <strong>{order.currency || 'PKR'} {(item.price * item.quantity / 100).toFixed(2)}</strong>
                            </div>
                        ))}
                    </div>
                )}

                <div style={styles.refreshNote}>
                    <p>🔄 This page updates automatically every 10 seconds</p>
                </div>
            </div>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: '20px'
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        gap: '20px',
        color: '#666'
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '4px solid #e9ecef',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    errorContainer: {
        maxWidth: '600px',
        margin: '0 auto',
        textAlign: 'center',
        padding: '40px 20px'
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px'
    },
    content: {
        maxWidth: '600px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    statusCard: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    statusBadge: {
        display: 'inline-block',
        padding: '8px 16px',
        borderRadius: '20px',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '16px',
        margin: '12px 0'
    },
    statusTime: {
        color: '#666',
        fontSize: '14px',
        margin: '8px 0 0 0'
    },
    detailsCard: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    detailRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0'
    },
    totalRow: {
        borderBottom: 'none',
        borderTop: '2px solid #667eea',
        paddingTop: '16px',
        marginTop: '8px',
        fontSize: '18px'
    },
    itemsCard: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    itemRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0'
    },
    refreshNote: {
        textAlign: 'center',
        color: '#666',
        fontSize: '14px',
        marginTop: '20px'
    }
};