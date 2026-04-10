'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';

interface MenuItem {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url?: string;
    is_available: boolean;
}

interface Category {
    id: string;
    name: string;
    items: MenuItem[];
}

interface CartItem extends MenuItem {
    qty: number;
}

export default function MenuPage() {
    const { slug } = useParams();
    const searchParams = useSearchParams();
    const [menu, setMenu] = useState<Category[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showCart, setShowCart] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [tableNumber, setTableNumber] = useState('5A');
    const [orderType, setOrderType] = useState('dine-in');
    const [orderQrCode, setOrderQrCode] = useState<string | null>(null);
    const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        const tableParam = searchParams?.get('table');
        if (tableParam) {
            const normalized = tableParam.toLowerCase();
            if (normalized === 'pickup') {
                setOrderType('pickup');
                setTableNumber('Pickup');
            } else {
                setOrderType('dine-in');
                setTableNumber(tableParam);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
            const updateDesktop = () => setIsDesktop(window.innerWidth > 768);
            updateDesktop();
            window.addEventListener('resize', updateDesktop);
            return () => window.removeEventListener('resize', updateDesktop);
        }
    }, []);

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                setLoading(true);
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
                const response = await fetch(`${apiUrl}/tenant/${slug}/menu`);

                if (!response.ok) throw new Error('Failed to fetch menu');

                const data = await response.json();
                setMenu(data.data || []);
                setConfig(data.config);
                if (data.data && data.data.length > 0) {
                    setSelectedCategory(data.data[0].id);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load menu');
                console.error('Menu fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        if (slug) fetchMenu();
    }, [slug]);

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { ...item, qty: 1 }];
        });
        showNotification(`${item.name} added to cart`, 'success');
    };

    const removeFromCart = (itemId: string, itemName: string) => {
        setCart(prev => prev.filter(i => i.id !== itemId));
        showNotification(`${itemName} removed from cart`, 'success');
    };

    const updateQuantity = (itemId: string, qty: number) => {
        if (qty <= 0) {
            const item = cart.find(i => i.id === itemId);
            removeFromCart(itemId, item?.name || 'Item');
        } else {
            setCart(prev => prev.map(i => i.id === itemId ? { ...i, qty } : i));
        }
    };

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const calculateTotals = () => {
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const taxRate = config?.tax_inclusive ? 0 : 0.18;
        const tax = Math.round(subtotal * taxRate);
        const total = config?.tax_inclusive ? subtotal : subtotal + tax;

        return {
            subtotal,
            tax,
            total,
            subtotalFormatted: (subtotal / 100).toFixed(2),
            taxFormatted: (tax / 100).toFixed(2),
            totalFormatted: (total / 100).toFixed(2)
        };
    };

    const placeOrder = async () => {
        try {
            if (cart.length === 0) {
                showNotification('Please add items to your order', 'error');
                return;
            }

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
            const payload = {
                tableNumber,
                orderType,
                items: cart.map(i => ({ id: i.id, quantity: i.qty }))
            };

            const response = await fetch(`${apiUrl}/tenant/${slug}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to place order');

            const data = await response.json();
            showNotification(`✅ Order #${data.orderId} placed successfully!`, 'success');
            setCart([]);
            setShowCart(false);
            setPlacedOrderId(data.orderId);

            // Generate QR code for order tracking
            const trackingUrl = `${window.location.origin}/order/${data.orderId}`;
            const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, { margin: 1, width: 200 });
            setOrderQrCode(qrCodeDataUrl);

            setTimeout(() => {
                alert(`Order Total: ${config?.currency || 'PKR'} ${data.grandTotal / 100}`);
            }, 500);
        } catch (err: any) {
            showNotification(`Error: ${err.message}`, 'error');
        }
    };

    const filteredMenu = menu.filter(category => {
        if (selectedCategory && category.id !== selectedCategory) return false;
        return true;
    });

    const allItems = menu.flatMap(cat => cat.items);
    const searchedItems = allItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totals = calculateTotals();

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Loading menu...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.loadingContainer}>
                <p style={{ color: '#dc3545' }}>Error: {error}</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                .cart-sidebar { animation: slideIn 0.3s ease-out; }
                .notification { animation: fadeIn 0.3s ease-out; }
                .add-btn { transition: all 0.3s ease; }
                .add-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
                .menu-item { transition: all 0.2s ease; }
                .menu-item:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
                * { box-sizing: border-box; }
            `}</style>

            {/* Notification Toast */}
            {notification && (
                <div style={{
                    ...styles.notification,
                    backgroundColor: notification.type === 'success' ? '#d4edda' : '#f8d7da',
                    color: notification.type === 'success' ? '#155724' : '#721c24',
                    borderColor: notification.type === 'success' ? '#c3e6cb' : '#f5c6cb'
                }} className="notification">
                    {notification.message}
                </div>
            )}

            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerContent}>
                    <div>
                        <h1 style={styles.title}>🍽️ Menu</h1>
                        <p style={styles.subtitle}>Explore our delicious dishes</p>
                    </div>
                    <button
                        onClick={() => setShowCart(!showCart)}
                        style={{
                            ...styles.cartBadgeBtn,
                            backgroundColor: cart.length > 0 ? '#ff6b6b' : '#e9ecef'
                        }}
                    >
                        🛒 {cart.length}
                    </button>
                </div>
            </header>

            {/* Search */}
            <div style={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="🔍 Search dishes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={styles.searchInput}
                />
            </div>

            {/* Main Content */}
            <div style={styles.mainContent}>
                {/* Left: Menu Items */}
                <div style={styles.menuSection}>
                    {searchTerm ? (
                        // Search Results
                        <div>
                            <h2 style={styles.sectionTitle}>Search Results</h2>
                            {searchedItems.length > 0 ? (
                                <div style={styles.itemsGrid}>
                                    {searchedItems.map((item) => (
                                        <div key={item.id} style={styles.menuItem} className="menu-item">
                                            <div style={styles.itemImage}>
                                                <span style={styles.itemEmoji}>🍲</span>
                                            </div>
                                            <div style={styles.itemContent}>
                                                <h3 style={styles.itemName}>{item.name}</h3>
                                                <p style={styles.itemDesc}>{item.description}</p>
                                                <div style={styles.itemFooter}>
                                                    <span style={styles.itemPrice}>
                                                        {config?.currency || 'PKR'} {(item.price / 100).toFixed(2)}
                                                    </span>
                                                    <button
                                                        onClick={() => addToCart(item)}
                                                        disabled={!item.is_available}
                                                        style={{
                                                            ...styles.addBtn,
                                                            ...(item.is_available ? styles.addBtnActive : styles.addBtnDisabled)
                                                        }}
                                                        className="add-btn"
                                                    >
                                                        + Add
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={styles.emptyMessage}>No dishes found matching your search</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Category Tabs */}
                            <div style={styles.categoryTabs}>
                                {menu.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        style={{
                                            ...styles.categoryTab,
                                            ...(selectedCategory === category.id ? styles.categoryTabActive : styles.categoryTabInactive)
                                        }}
                                    >
                                        {category.name}
                                    </button>
                                ))}
                            </div>

                            {/* Menu Items */}
                            {filteredMenu.map((category) => (
                                <div key={category.id}>
                                    <h2 style={styles.sectionTitle}>{category.name}</h2>
                                    {category.items && category.items.length > 0 ? (
                                        <div style={styles.itemsGrid}>
                                            {category.items.map((item) => (
                                                <div key={item.id} style={styles.menuItem} className="menu-item">
                                                    <div style={styles.itemImage}>
                                                        <span style={styles.itemEmoji}>🍲</span>
                                                    </div>
                                                    <div style={styles.itemContent}>
                                                        <h3 style={styles.itemName}>{item.name}</h3>
                                                        <p style={styles.itemDesc}>{item.description}</p>
                                                        <div style={styles.itemFooter}>
                                                            <span style={styles.itemPrice}>
                                                                {config?.currency || 'PKR'} {(item.price / 100).toFixed(2)}
                                                            </span>
                                                            <button
                                                                onClick={() => addToCart(item)}
                                                                disabled={!item.is_available}
                                                                style={{
                                                                    ...styles.addBtn,
                                                                    ...(item.is_available ? styles.addBtnActive : styles.addBtnDisabled)
                                                                }}
                                                                className="add-btn"
                                                            >
                                                                + Add
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={styles.emptyMessage}>No items in this category</p>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Right: Cart Sidebar */}
                {(showCart || isDesktop) && (
                    <div style={styles.cartSidebar} className="cart-sidebar">
                        <h2 style={styles.cartTitle}>Order Summary</h2>

                        {cart.length > 0 ? (
                            <>
                                {/* Cart Items */}
                                <div style={styles.cartItems}>
                                    {cart.map((item) => (
                                        <div key={item.id} style={styles.cartItem}>
                                            <div style={styles.cartItemInfo}>
                                                <h4 style={styles.cartItemName}>{item.name}</h4>
                                                <p style={styles.cartItemPrice}>
                                                    {config?.currency || 'PKR'} {((item.price * item.qty) / 100).toFixed(2)}
                                                </p>
                                            </div>
                                            <div style={styles.quantityControl}>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.qty - 1)}
                                                    style={styles.qtyBtn}
                                                >
                                                    −
                                                </button>
                                                <span style={styles.qtyDisplay}>{item.qty}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.qty + 1)}
                                                    style={styles.qtyBtn}
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item.id, item.name)}
                                                    style={styles.removeBtn}
                                                    title="Remove"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals */}
                                <div style={styles.cartTotals}>
                                    <div style={styles.totalRow}>
                                        <span>Subtotal:</span>
                                        <strong>{config?.currency || 'PKR'} {totals.subtotalFormatted}</strong>
                                    </div>
                                    {!config?.tax_inclusive && (
                                        <div style={styles.totalRow}>
                                            <span>Tax (18%):</span>
                                            <strong>{config?.currency || 'PKR'} {totals.taxFormatted}</strong>
                                        </div>
                                    )}
                                    <div style={styles.cartTotal}>
                                        <span>Total:</span>
                                        <strong style={styles.totalAmount}>{config?.currency || 'PKR'} {totals.totalFormatted}</strong>
                                    </div>
                                </div>

                                {/* Order Options */}
                                <div style={styles.orderOptions}>
                                    <div>
                                        <label style={styles.label}>Table Number</label>
                                        <input
                                            type="text"
                                            value={tableNumber}
                                            onChange={(e) => setTableNumber(e.target.value)}
                                            style={styles.input}
                                            placeholder="e.g., 5A"
                                        />
                                    </div>
                                    <div>
                                        <label style={styles.label}>Order Type</label>
                                        <select
                                            value={orderType}
                                            onChange={(e) => setOrderType(e.target.value)}
                                            style={styles.input}
                                        >
                                            <option value="dine-in">Dine-in</option>
                                            <option value="pickup">Pickup</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Place Order Button */}
                                <button
                                    onClick={placeOrder}
                                    style={styles.placeOrderBtn}
                                >
                                    ✓ Place Order ({cart.length} items)
                                </button>
                            </>
                        ) : (
                            <p style={styles.emptyCart}>Your cart is empty</p>
                        )}
                    </div>
                )}
            </div>

            {/* Order QR Code Modal */}
            {orderQrCode && placedOrderId && (
                <div style={styles.modalOverlay} onClick={() => { setOrderQrCode(null); setPlacedOrderId(null); }}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2>🎉 Order Placed Successfully!</h2>
                            <button
                                style={styles.closeBtn}
                                onClick={() => { setOrderQrCode(null); setPlacedOrderId(null); }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={styles.modalContent}>
                            <p style={styles.modalText}>
                                Your order <strong>#{placedOrderId}</strong> has been placed successfully!
                            </p>
                            <p style={styles.modalSubtext}>
                                Scan this QR code to track your order status:
                            </p>
                            <div style={styles.qrContainer}>
                                <img
                                    src={orderQrCode}
                                    alt="Order Tracking QR Code"
                                    style={styles.qrImage}
                                />
                            </div>
                            <p style={styles.qrUrl}>
                                Or visit: <code>{origin || 'https://your-site-url'}/order/{placedOrderId}</code>
                            </p>
                            <button
                                style={styles.doneBtn}
                                onClick={() => { setOrderQrCode(null); setPlacedOrderId(null); }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column'
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        gap: '20px',
        color: '#666'
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '4px solid #e9ecef',
        borderTop: '4px solid #007bff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    notification: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        border: '1px solid',
        zIndex: 1000,
        fontSize: '14px',
        fontWeight: '500'
    },
    header: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    headerContent: {
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: {
        margin: '0 0 4px 0',
        fontSize: '28px',
        fontWeight: 'bold'
    },
    subtitle: {
        margin: '0',
        fontSize: '14px',
        opacity: 0.9
    },
    cartBadgeBtn: {
        border: 'none',
        padding: '10px 16px',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease',
        color: 'white',
        minWidth: '60px'
    },
    searchContainer: {
        padding: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
    },
    searchInput: {
        width: '100%',
        padding: '12px 16px',
        border: '2px solid #e9ecef',
        borderRadius: '25px',
        fontSize: '16px',
        outline: 'none',
        transition: 'all 0.3s ease'
    },
    mainContent: {
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '20px',
        padding: '0 16px 100px 16px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
    },
    menuSection: {
        flex: 1
    },
    categoryTabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '8px'
    },
    categoryTab: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        transition: 'all 0.3s ease'
    },
    categoryTabActive: {
        backgroundColor: '#667eea',
        color: 'white'
    },
    categoryTabInactive: {
        backgroundColor: 'white',
        color: '#666',
        border: '2px solid #e9ecef'
    },
    sectionTitle: {
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#333',
        marginBottom: '16px',
        marginTop: '24px'
    },
    itemsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
    },
    menuItem: {
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column'
    },
    itemImage: {
        width: '100%',
        height: '120px',
        backgroundColor: '#f0f4ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid #e9ecef'
    },
    itemEmoji: {
        fontSize: '48px'
    },
    itemContent: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1
    },
    itemName: {
        margin: '0 0 4px 0',
        fontSize: '16px',
        fontWeight: '600',
        color: '#333'
    },
    itemDesc: {
        margin: '0 0 8px 0',
        fontSize: '13px',
        color: '#666',
        lineHeight: '1.4',
        flex: 1
    },
    itemFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    itemPrice: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#667eea'
    },
    addBtn: {
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        transition: 'all 0.3s ease'
    },
    addBtnActive: {
        backgroundColor: '#667eea',
        color: 'white'
    },
    addBtnDisabled: {
        backgroundColor: '#ccc',
        color: 'white',
        cursor: 'not-allowed',
        opacity: 0.6
    },
    emptyMessage: {
        textAlign: 'center',
        color: '#999',
        padding: '32px 16px'
    },
    emptyCart: {
        textAlign: 'center',
        color: '#999',
        padding: '40px 20px',
        fontSize: '16px'
    },
    cartSidebar: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: '120px',
        height: 'fit-content',
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto'
    },
    cartTitle: {
        margin: '0 0 16px 0',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333'
    },
    cartItems: {
        marginBottom: '16px',
        maxHeight: '300px',
        overflowY: 'auto'
    },
    cartItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0',
        gap: '8px'
    },
    cartItemInfo: {
        flex: 1,
        minWidth: '0'
    },
    cartItemName: {
        margin: '0 0 4px 0',
        fontSize: '14px',
        fontWeight: '600',
        color: '#333',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    cartItemPrice: {
        margin: '0',
        fontSize: '13px',
        color: '#667eea',
        fontWeight: '600'
    },
    quantityControl: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0
    },
    qtyBtn: {
        width: '28px',
        height: '28px',
        border: '1px solid #ddd',
        backgroundColor: 'white',
        cursor: 'pointer',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#667eea',
        transition: 'all 0.2s ease'
    },
    qtyDisplay: {
        width: '24px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: '600'
    },
    removeBtn: {
        width: '28px',
        height: '28px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        fontSize: '16px',
        opacity: 0.7,
        transition: 'opacity 0.2s ease'
    },
    cartTotals: {
        borderTop: '2px solid #f0f0f0',
        paddingTop: '12px',
        marginBottom: '16px'
    },
    totalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: '#666',
        marginBottom: '8px'
    },
    cartTotal: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#333',
        paddingTop: '8px',
        borderTop: '1px solid #f0f0f0'
    },
    totalAmount: {
        color: '#667eea',
        fontSize: '18px'
    },
    orderOptions: {
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    label: {
        display: 'block',
        fontSize: '12px',
        fontWeight: '600',
        color: '#666',
        marginBottom: '4px'
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #e9ecef',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s ease'
    },
    placeOrderBtn: {
        width: '100%',
        padding: '12px 16px',
        backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        textAlign: 'center'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    modalContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
    },
    modalText: {
        margin: '0',
        fontSize: '16px',
        color: '#333'
    },
    modalSubtext: {
        margin: '0',
        fontSize: '14px',
        color: '#666'
    },
    qrContainer: {
        padding: '16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        border: '2px solid #e9ecef'
    },
    qrImage: {
        width: '200px',
        height: '200px',
        borderRadius: '8px'
    },
    qrUrl: {
        fontSize: '12px',
        color: '#666',
        wordBreak: 'break-all'
    },
    doneBtn: {
        padding: '10px 24px',
        backgroundColor: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#666',
        padding: '0',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }
};

