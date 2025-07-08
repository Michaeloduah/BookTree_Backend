const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'schoolplus_db';
const client = new MongoClient(uri);

// Helper function to get user collection
async function getUserCollection() {
    return client.db(dbName).collection('users');
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            success: false,
            error: 'Access token required' 
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false,
                error: 'Invalid or expired token' 
            });
        }
        req.user = user;
        next();
    });
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const userCollection = await getUserCollection();
        const user = await userCollection.findOne({ _id: new ObjectId(req.user.userId) });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Admin access required' 
            });
        }
        
        req.user.role = user.role; // Add role to request user object
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify admin status'
        });
    }
};

// Middleware to check if user exists and add role info
const addUserRole = async (req, res, next) => {
    try {
        const userCollection = await getUserCollection();
        const user = await userCollection.findOne({ _id: new ObjectId(req.user.userId) });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        req.user.role = user.role || 'user';
        req.user.name = user.name;
        req.user.email = user.email;
        next();
    } catch (error) {
        console.error('User role check error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify user'
        });
    }
};

// Optional authentication (for routes that work with or without auth)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
};

module.exports = {
    authenticateToken,
    requireAdmin,
    addUserRole,
    optionalAuth
};