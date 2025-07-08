const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Middleware to verify JWT token
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Admin access required' 
        });
    }
    next();
};

// All order routes require authentication
router.use(authenticateToken);

// Order routes
router.get('/', orderController.getAllOrders);                    // GET /api/orders
router.get('/stats', orderController.getOrderStats);              // GET /api/orders/stats
router.get('/user/:userId', requireAdmin, orderController.getUserOrders); // GET /api/orders/user/:userId (admin only)
router.get('/:id', orderController.getOrderById);                 // GET /api/orders/:id

router.post('/', orderController.createOrder);                    // POST /api/orders
router.post('/from-cart', orderController.createOrderFromCart);   // POST /api/orders/from-cart

router.put('/:id', requireAdmin, orderController.updateOrder);    // PUT /api/orders/:id (admin only)
router.put('/:id/status', orderController.updateOrderStatus);     // PUT /api/orders/:id/status

module.exports = router;