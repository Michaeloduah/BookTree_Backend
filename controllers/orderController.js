const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection setup
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'schoolplus_db';
const client = new MongoClient(uri);

// Helper functions to get collections
async function getOrderCollection() {
    return client.db(dbName).collection('orders');
}

async function getBookCollection() {
    return client.db(dbName).collection('books');
}

async function getUserCollection() {
    return client.db(dbName).collection('users');
}

class Order {
    constructor({ userId, items, totalAmount, status, shippingAddress, paymentMethod, notes, _id }) {
        this.userId = userId;
        this.items = items;
        this.totalAmount = Number(totalAmount);
        this.status = status || 'pending';
        this.shippingAddress = shippingAddress;
        this.paymentMethod = paymentMethod;
        this.notes = notes;
        if (_id) this._id = _id;
    }

    static async create(orderData) {
        const collection = await getOrderCollection();
        const order = {
            ...orderData,
            totalAmount: Number(orderData.totalAmount),
            status: orderData.status || 'pending',
            orderNumber: await this.generateOrderNumber(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await collection.insertOne(order);
        return new Order({ ...order, _id: result.insertedId });
    }

    static async findAll(filter = {}, options = {}) {
        const collection = await getOrderCollection();
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const skip = (page - 1) * limit;
        
        const orders = await collection
            .find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray();
        
        const total = await collection.countDocuments(filter);
        
        return {
            orders: orders.map(order => new Order(order)),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async findById(id) {
        const collection = await getOrderCollection();
        const order = await collection.findOne({ _id: new ObjectId(id) });
        return order ? new Order(order) : null;
    }

    static async findByUserId(userId, options = {}) {
        return this.findAll({ userId: new ObjectId(userId) }, options);
    }

    static async updateById(id, updateData) {
        const collection = await getOrderCollection();
        const update = {
            ...updateData,
            updatedAt: new Date()
        };
        if (updateData.totalAmount) update.totalAmount = Number(updateData.totalAmount);
        
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: update }
        );
        return result;
    }

    static async updateStatus(id, status, notes = '') {
        const collection = await getOrderCollection();
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    status, 
                    updatedAt: new Date() 
                },
                $push: {
                    statusHistory: {
                        status,
                        notes,
                        timestamp: new Date()
                    }
                }
            }
        );
        return result;
    }

    static async generateOrderNumber() {
        const collection = await getOrderCollection();
        const count = await collection.countDocuments();
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `ORD-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
    }

    static async getOrderStats(userId = null) {
        const collection = await getOrderCollection();
        const matchStage = userId ? { userId: new ObjectId(userId) } : {};
        
        const stats = await collection.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                    }
                }
            }
        ]).toArray();

        return stats[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0
        };
    }
}

// Controller functions
const orderController = {
    // GET /api/orders - Get all orders (admin) or user's orders
    getAllOrders: async (req, res) => {
        try {
            const { page = 1, limit = 10, status, userId } = req.query;
            const { user } = req;
            
            let filter = {};
            
            // If not admin, only show user's own orders
            if (user.role !== 'admin' && !userId) {
                filter.userId = new ObjectId(user.userId);
            } else if (userId) {
                filter.userId = new ObjectId(userId);
            }
            
            // Filter by status
            if (status) {
                filter.status = status;
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { createdAt: -1 }
            };

            const result = await Order.findAll(filter, options);

            res.json({
                success: true,
                data: result.orders,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('Get orders error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch orders'
            });
        }
    },

    // GET /api/orders/:id - Get single order
    getOrderById: async (req, res) => {
        try {
            const { id } = req.params;
            const { user } = req;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid order ID'
                });
            }

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            // Check if user can access this order
            if (user.role !== 'admin' && order.userId.toString() !== user.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            res.json({
                success: true,
                data: order
            });

        } catch (error) {
            console.error('Get order error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch order'
            });
        }
    },

    // POST /api/orders - Create new order
    createOrder: async (req, res) => {
        try {
            const { items, shippingAddress, paymentMethod, notes } = req.body;
            const { user } = req;

            // Validation
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Order items are required'
                });
            }

            if (!shippingAddress || !shippingAddress.address || !shippingAddress.city) {
                return res.status(400).json({
                    success: false,
                    error: 'Shipping address with address and city is required'
                });
            }

            if (!paymentMethod) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment method is required'
                });
            }

            // Validate and calculate order total
            let totalAmount = 0;
            const bookCollection = await getBookCollection();
            const validatedItems = [];

            for (const item of items) {
                if (!item.bookId || !item.quantity || item.quantity <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Each item must have a valid bookId and quantity'
                    });
                }

                // Fetch book details
                const book = await bookCollection.findOne({ _id: new ObjectId(item.bookId) });
                if (!book) {
                    return res.status(404).json({
                        success: false,
                        error: `Book with ID ${item.bookId} not found`
                    });
                }

                // Check stock availability
                if (book.stock < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        error: `Insufficient stock for "${book.title}". Available: ${book.stock}, Requested: ${item.quantity}`
                    });
                }

                const itemTotal = book.price * item.quantity;
                totalAmount += itemTotal;

                validatedItems.push({
                    bookId: book._id,
                    title: book.title,
                    author: book.author,
                    price: book.price,
                    quantity: item.quantity,
                    subtotal: itemTotal
                });
            }

            // Create order
            const orderData = {
                userId: new ObjectId(user.userId),
                items: validatedItems,
                totalAmount,
                shippingAddress,
                paymentMethod,
                notes: notes || '',
                status: 'pending',
                statusHistory: [{
                    status: 'pending',
                    notes: 'Order created',
                    timestamp: new Date()
                }]
            };

            const order = await Order.create(orderData);

            // Update book stock
            for (const item of validatedItems) {
                await bookCollection.updateOne(
                    { _id: new ObjectId(item.bookId) },
                    { $inc: { stock: -item.quantity } }
                );
            }

            // Clear user's cart
            const userCollection = await getUserCollection();
            await userCollection.updateOne(
                { _id: new ObjectId(user.userId) },
                { $set: { cart: [] } }
            );

            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                data: order
            });

        } catch (error) {
            console.error('Create order error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create order'
            });
        }
    },

    // PUT /api/orders/:id/status - Update order status
    updateOrderStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;
            const { user } = req;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid order ID'
                });
            }

            const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status. Valid statuses: ' + validStatuses.join(', ')
                });
            }

            // Check if order exists
            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            // Only admin or order owner can update status
            if (user.role !== 'admin' && order.userId.toString() !== user.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Users can only cancel their own orders if status is pending
            if (user.role !== 'admin' && status !== 'cancelled' && order.status !== 'pending') {
                return res.status(403).json({
                    success: false,
                    error: 'You can only cancel pending orders'
                });
            }

            await Order.updateStatus(id, status, notes || '');

            const updatedOrder = await Order.findById(id);

            res.json({
                success: true,
                message: 'Order status updated successfully',
                data: updatedOrder
            });

        } catch (error) {
            console.error('Update order status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update order status'
            });
        }
    },

    // PUT /api/orders/:id - Update order details
    updateOrder: async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const { user } = req;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid order ID'
                });
            }

            // Check if order exists
            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            // Only admin can update order details
            if (user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only administrators can update order details'
                });
            }

            // Don't allow updating certain fields
            delete updateData.userId;
            delete updateData.orderNumber;
            delete updateData.createdAt;
            delete updateData._id;

            const result = await Order.updateById(id, updateData);

            if (result.matchedCount === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            const updatedOrder = await Order.findById(id);

            res.json({
                success: true,
                message: 'Order updated successfully',
                data: updatedOrder
            });

        } catch (error) {
            console.error('Update order error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update order'
            });
        }
    },

    // GET /api/orders/stats - Get order statistics
    getOrderStats: async (req, res) => {
        try {
            const { user } = req;
            const { userId } = req.query;

            let targetUserId = null;
            
            // If not admin, only show own stats
            if (user.role !== 'admin') {
                targetUserId = user.userId;
            } else if (userId) {
                targetUserId = userId;
            }

            const stats = await Order.getOrderStats(targetUserId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Get order stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch order statistics'
            });
        }
    },

    // POST /api/orders/from-cart - Create order from user's cart
    createOrderFromCart: async (req, res) => {
        try {
            const { shippingAddress, paymentMethod, notes } = req.body;
            const { user } = req;

            // Get user's cart
            const userCollection = await getUserCollection();
            const userData = await userCollection.findOne({ _id: new ObjectId(user.userId) });
            
            if (!userData || !userData.cart || userData.cart.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Cart is empty'
                });
            }

            // Convert cart items to order items format
            const items = userData.cart.map(cartItem => ({
                bookId: cartItem.bookId || cartItem._id, // Handle different cart formats
                quantity: cartItem.quantity
            }));

            // Create order using existing createOrder logic
            req.body = { items, shippingAddress, paymentMethod, notes };
            return orderController.createOrder(req, res);

        } catch (error) {
            console.error('Create order from cart error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create order from cart'
            });
        }
    },

    // GET /api/orders/user/:userId - Get orders for specific user (admin only)
    getUserOrders: async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const { user } = req;

            // Only admin can access other users' orders
            if (user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            if (!ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid user ID'
                });
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { createdAt: -1 }
            };

            const result = await Order.findByUserId(userId, options);

            res.json({
                success: true,
                data: result.orders,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('Get user orders error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user orders'
            });
        }
    }
};

module.exports = orderController;