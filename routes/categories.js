const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

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

// Public routes (no authentication required)
router.get('/', categoryController.getAllCategories);           // GET /api/categories
router.get('/:id', categoryController.getCategoryById);         // GET /api/categories/:id

// Protected admin routes
router.post('/', authenticateToken, requireAdmin, categoryController.createCategory);       // POST /api/categories
router.put('/:id', authenticateToken, requireAdmin, categoryController.updateCategory);     // PUT /api/categories/:id
router.delete('/:id', authenticateToken, requireAdmin, categoryController.deleteCategory);  // DELETE /api/categories/:id
router.put('/:id/toggle', authenticateToken, requireAdmin, categoryController.toggleCategoryStatus); // PUT /api/categories/:id/toggle

module.exports = router;