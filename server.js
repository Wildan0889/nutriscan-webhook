// Simple webhook server untuk deployment
const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage
const orders = [];
const activationCodes = new Map();

// Generate activation code
function generateActivationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// MyLink Webhook Endpoint
app.post('/mylink-webhook', (req, res) => {
    try {
        console.log('=== MYLINK WEBHOOK RECEIVED ===');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        // Handle different data formats from LYNK/MyLink
        let orderData = req.body;
        
        // LYNK sends data in { event: "...", data: {...} } format
        if (orderData.data && typeof orderData.data === 'object') {
            orderData = orderData.data;
            console.log('📦 Extracted data from LYNK format');
        }
        
        // Map different field names to standard format
        const order_id = orderData.order_id || orderData.id || orderData.transaction_id || orderData.trx_id || orderData.orderId;
        const customer_email = orderData.customer_email || orderData.email || orderData.buyer_email || orderData.customerEmail;
        const customer_name = orderData.customer_name || orderData.name || orderData.buyer_name || orderData.customerName;
        const product_name = orderData.product_name || orderData.product || orderData.item_name || orderData.productName;
        const amount = orderData.amount || orderData.total || orderData.price || orderData.totalAmount;
        const status = orderData.status || orderData.state || orderData.order_status || orderData.orderStatus;
        const timestamp = orderData.timestamp || orderData.created_at || orderData.date || orderData.createdAt;
        
        console.log('Mapped data:', {
            order_id,
            customer_email,
            customer_name,
            product_name,
            amount,
            status,
            timestamp
        });
        
        // Debug: Show what fields are available in the data
        console.log('🔍 Available fields in data:', Object.keys(orderData));
        console.log('🔍 Raw data object:', JSON.stringify(orderData, null, 2));
        
        if (!order_id || !customer_email || !customer_name) {
            console.log('❌ Missing required fields:', {
                order_id: !!order_id,
                customer_email: !!customer_email,
                customer_name: !!customer_name
            });
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                received_fields: Object.keys(req.body),
                required_fields: ['order_id', 'customer_email', 'customer_name']
            });
        }
        
        // Check if order already processed
        const existingOrder = orders.find(order => order.order_id === order_id);
        if (existingOrder) {
            return res.status(200).json({
                success: true,
                message: 'Order already processed',
                activation_code: existingOrder.activation_code
            });
        }
        
        // Generate activation code
        const activationCode = generateActivationCode();
        
        // Store order
        const order = {
            order_id,
            customer_email,
            customer_name,
            product_name: product_name || 'NutriScan Premium - 1 Month',
            amount: amount || 25000,
            status: status || 'completed',
            timestamp: timestamp || new Date().toISOString(),
            activation_code: activationCode,
            created_at: new Date().toISOString()
        };
        
        orders.push(order);
        activationCodes.set(activationCode, order);
        
        console.log('✅ Order processed:', order_id);
        console.log('📧 Customer:', customer_email);
        console.log('🔑 Activation Code:', activationCode);
        
        // Simulate sending email (in production, use real email service)
        console.log('📧 Sending activation code to', customer_email);
        console.log('🔑 Activation Code:', activationCode);
        console.log('        ============================================');
        console.log('        🎉 NUTRISCAN PREMIUM AKTIVASI');
        console.log('        ============================================');
        console.log('        Halo', customer_name, '!');
        console.log('        Terima kasih telah membeli NutriScan Premium melalui TikTok Shop');
        console.log('        🔑 KODE AKTIVASI ANDA:', activationCode);
        console.log('        📅 Berlaku hingga:', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID'));
        console.log('        ');
        console.log('        📱 Cara menggunakan NutriScan:');
        console.log('        1. Buka aplikasi NutriScan');
        console.log('        2. Masuk ke halaman Premium');
        console.log('        3. Masukkan kode aktivasi:', activationCode);
        console.log('        4. Nikmati fitur premium selama 1 bulan!');
        console.log('        ❓ Butuh bantuan? Hubungi admin di WhatsApp');
        console.log('        ============================================');
        
        // Return success response
        res.status(200).json({
            success: true,
            message: 'Order processed successfully',
            order_id: order_id,
            activation_code: activationCode,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Activation Code Verification Endpoint
app.post('/verify-activation', (req, res) => {
    try {
        const { activation_code } = req.body;
        
        if (!activation_code) {
            return res.status(400).json({
                success: false,
                error: 'Activation code is required'
            });
        }
        
        const order = activationCodes.get(activation_code);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Invalid activation code'
            });
        }
        
        // Check if code is expired (30 days)
        const expiryDate = new Date(order.created_at);
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        if (new Date() > expiryDate) {
            return res.status(400).json({
                success: false,
                error: 'Activation code has expired'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Activation code is valid',
            order: {
                order_id: order.order_id,
                customer_name: order.customer_name,
                product_name: order.product_name,
                expires_at: expiryDate.toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Webhook service is running',
        timestamp: new Date().toISOString(),
        orders_count: orders.length,
        activation_codes_count: activationCodes.size
    });
});

// Get All Orders (for admin)
app.get('/orders', (req, res) => {
    res.status(200).json({
        success: true,
        orders: orders,
        total: orders.length
    });
});

// Get Order by ID
app.get('/orders/:orderId', (req, res) => {
    const orderId = req.params.orderId;
    const order = orders.find(o => o.order_id === orderId);
    
    if (!order) {
        return res.status(404).json({
            success: false,
            error: 'Order not found'
        });
    }
    
    res.status(200).json({
        success: true,
        order: order
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'NutriScan MyLink Webhook Service',
        version: '1.0.0',
        endpoints: {
            webhook: '/mylink-webhook',
            verify: '/verify-activation',
            health: '/health',
            orders: '/orders',
            order_by_id: '/orders/:orderId'
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 MyLink Webhook Service running on port', PORT);
    console.log('📡 Webhook URL: http://localhost:' + PORT + '/mylink-webhook');
    console.log('🔍 Health Check: http://localhost:' + PORT + '/health');
});

module.exports = app;
