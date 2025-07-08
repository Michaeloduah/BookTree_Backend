// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'https://booktree-ijgo.onrender.com', '*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  next();
});

// MongoDB connection setup
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017'; // fallback for local dev
const dbName = 'schoolplus_db';
const client = new MongoClient(uri);

async function connectToMongo() {
    try {
        await client.connect();
        console.log('Connected to MongoDB successfully');
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }
}

async function getUserCollection() {
    return client.db(dbName).collection('users');
}

class User {
    constructor({ name, email, password, _id, cart = [] }) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.cart = cart;
        if (_id) this._id = _id;
    }

    static async create(userData) {
        const collection = await getUserCollection();
        const result = await collection.insertOne(userData);
        return new User({ ...userData, _id: result.insertedId });
    }

    static async findByEmail(email) {
        const collection = await getUserCollection();
        const user = await collection.findOne({ email });
        return user ? new User(user) : null;
    }

    static async findById(id) {
        const collection = await getUserCollection();
        const user = await collection.findOne({ _id: new ObjectId(id) });
        return user ? new User(user) : null;
    }
}

// Import routes
const userRoutes = require('./routes/user');
const bookRoutes = require('./routes/books');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
    res.send('Server is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: error.message 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl 
    });
});

const PORT = process.env.PORT || 3000;

connectToMongo().then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`Available routes:`);
        console.log(`\n📚 BOOK ROUTES:`);
        console.log(`  GET    /api/books                    - Get all books`);
        console.log(`  GET    /api/books/:id                - Get book by ID`);
        console.log(`  GET    /api/books/search?q=term      - Search books`);
        console.log(`  GET    /api/books/category/:id       - Get books by category`);
        console.log(`  POST   /api/books                    - Create book (Admin)`);
        console.log(`  PUT    /api/books/:id                - Update book (Admin)`);
        console.log(`  DELETE /api/books/:id                - Delete book (Admin)`);
        
        console.log(`\n📂 CATEGORY ROUTES:`);
        console.log(`  GET    /api/categories               - Get all categories`);
        console.log(`  GET    /api/categories/:id           - Get category by ID`);
        console.log(`  POST   /api/categories               - Create category (Admin)`);
        console.log(`  PUT    /api/categories/:id           - Update category (Admin)`);
        console.log(`  PUT    /api/categories/:id/toggle    - Toggle category status (Admin)`);
        console.log(`  DELETE /api/categories/:id           - Delete category (Admin)`);
        
        console.log(`\n👤 USER ROUTES:`);
        console.log(`  POST   /api/users/register           - Register user`);
        console.log(`  POST   /api/users/login              - Login user`);
        console.log(`  GET    /api/users/profile            - Get user profile`);
        console.log(`  PUT    /api/users/profile            - Update user profile`);
        console.log(`  POST   /api/users/cart/add           - Add item to cart`);
        console.log(`  PUT    /api/users/cart/update        - Update cart item`);
        console.log(`  DELETE /api/users/cart/remove        - Remove item from cart`);
        console.log(`  GET    /api/users/cart               - Get user's cart`);
        console.log(`  POST   /api/users/cart/clear         - Clear cart`);
        
        console.log(`\n🛒 ORDER ROUTES:`);
        console.log(`  GET    /api/orders                   - Get orders`);
        console.log(`  GET    /api/orders/:id               - Get order by ID`);
        console.log(`  GET    /api/orders/stats             - Get order statistics`);
        console.log(`  GET    /api/orders/user/:userId      - Get user orders (Admin)`);
        console.log(`  POST   /api/orders                   - Create order`);
        console.log(`  POST   /api/orders/from-cart         - Create order from cart`);
        console.log(`  PUT    /api/orders/:id               - Update order (Admin)`);
        console.log(`  PUT    /api/orders/:id/status        - Update order status`);
        
        console.log(`\n🔧 SYSTEM ROUTES:`);
        console.log(`  GET    /                             - Server status`);
        console.log(`  GET    /health                       - Health check`);
    });
});