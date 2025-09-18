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
        
        // If data is nested, extract it
        if (orderData.data) {
            orderData = orderData.data;
        }
        
        // Map different field names to standard format
        const order_id = orderData.order_id || orderData.id || orderData.transaction_id || orderData.trx_id;
        const customer_email = orderData.customer_email || orderData.email || orderData.buyer_email;
        const customer_name = orderData.customer_name || orderData.name || orderData.buyer_name;
        const product_name = orderData.product_name || orderData.product || orderData.item_name;
        const amount = orderData.amount || orderData.total || orderData.price;
        const status = orderData.status || orderData.state || orderData.order_status;
        const timestamp = orderData.timestamp || orderData.created_at || orderData.date;
        
        console.log('Mapped data:', {
            order_id,
            customer_email,
            customer_name,
            product_name,
            amount,
            status,
            timestamp
        });
        
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
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Store order
        const order = {
            order_id,
            customer_email,
            customer_name,
            product_name: product_name || 'NutriScan Premium - 1 Month',
            amount: amount || 25000,
            status: status || 'completed',
            activation_code: activationCode,
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            source: 'mylink_tiktok'
        };
        
        orders.push(order);
        activationCodes.set(activationCode, {
            email: customer_email,
            name: customer_name,
            order_id,
            expires_at: expiresAt.toISOString(),
            used: false
        });
        
        console.log(`✅ Order processed: ${order_id}`);
        console.log(`📧 Customer: ${customer_email}`);
        console.log(`🔑 Activation Code: ${activationCode}`);
        
        // Send notification (log for now)
        console.log(`
        ============================================
        🎉 NUTRISCAN PREMIUM AKTIVASI
        ============================================
        
        Halo ${customer_name}!
        
        Terima kasih telah membeli NutriScan Premium melalui TikTok Shop!
        
        🔑 KODE AKTIVASI ANDA: ${activationCode}
        📅 Berlaku hingga: ${expiresAt.toLocaleDateString('id-ID')}
        
        📱 Cara menggunakan:
        1. Buka aplikasi NutriScan
        2. Masuk ke halaman Premium
        3. Masukkan kode aktivasi: ${activationCode}
        4. Nikmati fitur premium selama 1 bulan!
        
        ❓ Butuh bantuan? Hubungi admin di WhatsApp
        
        ============================================
        `);
        
        res.status(200).json({
            success: true,
            message: 'Order processed successfully',
            order_id,
            activation_code: activationCode,
            expires_at: expiresAt.toISOString()
        });
        
    } catch (error) {
        console.error('Error processing MyLink webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Verify activation code endpoint
app.post('/verify-activation', (req, res) => {
    try {
        const { activation_code, user_email } = req.body;
        
        if (!activation_code) {
            return res.status(400).json({
                success: false,
                error: 'Activation code required'
            });
        }
        
        const codeData = activationCodes.get(activation_code);
        
        if (!codeData) {
            return res.status(404).json({
                success: false,
                error: 'Invalid activation code'
            });
        }
        
        if (codeData.used) {
            return res.status(400).json({
                success: false,
                error: 'Activation code already used'
            });
        }
        
        if (new Date(codeData.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Activation code expired'
            });
        }
        
        // Mark as used
        codeData.used = true;
        codeData.used_at = new Date().toISOString();
        codeData.user_email = user_email;
        
        res.status(200).json({
            success: true,
            message: 'Activation successful',
            expires_at: codeData.expires_at,
            customer_name: codeData.name
        });
        
    } catch (error) {
        console.error('Error verifying activation:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get orders endpoint
app.get('/orders', (req, res) => {
    try {
        res.status(200).json({
            success: true,
            orders: orders,
            total: orders.length
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'NutriScan MyLink Webhook Service is running',
        timestamp: new Date().toISOString(),
        orders_count: orders.length,
        active_codes: activationCodes.size,
        environment: process.env.NODE_ENV || 'development'
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
            orders: '/orders',
            health: '/health'
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 NutriScan MyLink Webhook Service running on port ${PORT}`);
    console.log(`📡 Webhook URL: http://localhost:${PORT}/mylink-webhook`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
