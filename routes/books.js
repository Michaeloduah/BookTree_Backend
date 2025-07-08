const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

// Middleware to verify JWT token (you can import this from your user routes)
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

// Optional middleware for admin only routes
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
router.get('/', bookController.getAllBooks);                    // GET /api/books
router.get('/search', bookController.searchBooks);              // GET /api/books/search?q=term
router.get('/category/:categoryId', bookController.getBooksByCategory); // GET /api/books/category/:categoryId
router.get('/:id', bookController.getBookById);                 // GET /api/books/:id

// Protected routes (authentication required)
// Admin only routes for creating, updating, and deleting books
router.post('/', authenticateToken, requireAdmin, bookController.createBook);       // POST /api/books
router.put('/:id', authenticateToken, requireAdmin, bookController.updateBook);     // PUT /api/books/:id
router.delete('/:id', authenticateToken, requireAdmin, bookController.deleteBook);  // DELETE /api/books/:id

module.exports = router;