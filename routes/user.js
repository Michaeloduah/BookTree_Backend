const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const router = express.Router();

// MongoDB connection setup (you can import this from your main file or create a separate db config)
const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = "schoolplus_db";
const client = new MongoClient(uri);

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Helper function to get user collection
async function getUserCollection() {
  return client.db(dbName).collection("users");
}

// User class (same as in your main file)
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

  static async updateById(id, updateData) {
    const collection = await getUserCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    return result;
  }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// POST /api/users/register - User Registration
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: "User with this email already exists",
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user", // Set default role
      cart: [],
      createdAt: new Date(),
    };

    const user = await User.create(userData);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/login - User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        cart: user.cart,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/profile - Get User Profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        cart: user.cart,
      },
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/users/profile - Update User Profile
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    await User.updateById(req.user.userId, { name });

    res.json({
      message: "Profile updated successfully",
      user: { name },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/cart/add - Add item to cart
router.post("/cart/add", authenticateToken, async (req, res) => {
  try {
    const { title, author, price, description } = req.body;

    if (!title || !author || !price) {
      return res.status(400).json({
        error: "Title, author, and price are required",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if item already exists in cart
    const existingItemIndex = user.cart.findIndex(
      (item) => item.title === title
    );

    if (existingItemIndex !== -1) {
      // Increase quantity if item exists
      user.cart[existingItemIndex].quantity += 1;
    } else {
      // Add new item
      user.cart.push({
        title,
        author,
        price: Number(price),
        description,
        quantity: 1,
        addedAt: new Date(),
      });
    }

    await User.updateById(req.user.userId, { cart: user.cart });

    res.json({
      message: "Item added to cart",
      cart: user.cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/users/cart/update - Update cart item quantity
router.put("/cart/update", authenticateToken, async (req, res) => {
  try {
    const { title, quantity } = req.body;

    if (!title || quantity < 0) {
      return res.status(400).json({
        error: "Valid title and quantity are required",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const itemIndex = user.cart.findIndex((item) => item.title === title);
    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      user.cart.splice(itemIndex, 1);
    } else {
      // Update quantity
      user.cart[itemIndex].quantity = quantity;
    }

    await User.updateById(req.user.userId, { cart: user.cart });

    res.json({
      message: "Cart updated successfully",
      cart: user.cart,
    });
  } catch (error) {
    console.error("Cart update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/cart/remove - Remove item from cart
router.delete("/cart/remove", authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.cart = user.cart.filter((item) => item.title !== title);
    await User.updateById(req.user.userId, { cart: user.cart });

    res.json({
      message: "Item removed from cart",
      cart: user.cart,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/cart - Get user's cart
router.get("/cart", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      cart: user.cart || [],
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/cart/clear - Clear user's cart
router.post("/cart/clear", authenticateToken, async (req, res) => {
  try {
    await User.updateById(req.user.userId, { cart: [] });

    res.json({
      message: "Cart cleared successfully",
      cart: [],
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
