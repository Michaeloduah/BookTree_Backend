const { MongoClient, ObjectId } = require("mongodb");

// MongoDB connection setup
const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "schoolplus_db";
const client = new MongoClient(uri);

// Helper function to get book collection
async function getBookCollection() {
  return client.db(dbName).collection("books");
}

class Book {
  constructor({ title, author, description, price, category, stock, _id }) {
    this.title = title;
    this.author = author;
    this.description = description;
    this.price = Number(price);
    this.category = category;
    this.stock = Number(stock);
    if (_id) this._id = _id;
  }

  static async create(bookData) {
    const collection = await getBookCollection();
    const book = {
      ...bookData,
      price: Number(bookData.price),
      stock: Number(bookData.stock),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await collection.insertOne(book);
    return new Book({ ...book, _id: result.insertedId });
  }

  static async findAll(filter = {}, options = {}) {
    const collection = await getBookCollection();
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;

    const books = await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments(filter);

    return {
      books: books.map((book) => new Book(book)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async findById(id) {
    const collection = await getBookCollection();
    const book = await collection.findOne({ _id: new ObjectId(id) });
    return book ? new Book(book) : null;
  }

  static async updateById(id, updateData) {
    const collection = await getBookCollection();
    const update = {
      ...updateData,
      updatedAt: new Date(),
    };
    if (updateData.price) update.price = Number(updateData.price);
    if (updateData.stock) update.stock = Number(updateData.stock);

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    return result;
  }

  static async deleteById(id) {
    const collection = await getBookCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result;
  }

  static async findByCategory(categoryId, options = {}) {
    return this.findAll({ category: categoryId }, options);
  }

  static async search(searchTerm, options = {}) {
    const filter = {
      $or: [
        { title: { $regex: searchTerm, $options: "i" } },
        { author: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
    };
    return this.findAll(filter, options);
  }
}

// Controller functions
const bookController = {
  // GET /api/books - Get all books
  getAllBooks: async (req, res) => {
    try {
      const { page = 1, limit = 10, category, search, sort } = req.query;
      let filter = {};
      let sortOptions = { createdAt: -1 };

      // Filter by category
      if (category) {
        filter.category = category;
      }

      // Search functionality
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { author: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      // Sort options
      if (sort) {
        switch (sort) {
          case "price_asc":
            sortOptions = { price: 1 };
            break;
          case "price_desc":
            sortOptions = { price: -1 };
            break;
          case "title_asc":
            sortOptions = { title: 1 };
            break;
          case "title_desc":
            sortOptions = { title: -1 };
            break;
          default:
            sortOptions = { createdAt: -1 };
        }
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: sortOptions,
      };

      const result = await Book.findAll(filter, options);

      res.json({
        success: true,
        data: result.books,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get books error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch books",
      });
    }
  },

  // GET /api/books/:id - Get single book
  getBookById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid book ID",
        });
      }

      const book = await Book.findById(id);
      if (!book) {
        return res.status(404).json({
          success: false,
          error: "Book not found",
        });
      }

      res.json({
        success: true,
        data: book,
      });
    } catch (error) {
      console.error("Get book error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch book",
      });
    }
  },

  // POST /api/books - Create new book
  createBook: async (req, res) => {
    try {
      const { title, author, description, price, category, stock } = req.body;

      // Validation
      if (!title || !author || !price || !category) {
        return res.status(400).json({
          success: false,
          error: "Title, author, price, and category are required",
        });
      }

      if (price <= 0) {
        return res.status(400).json({
          success: false,
          error: "Price must be greater than 0",
        });
      }

      const bookData = {
        title,
        author,
        description: description || "",
        price: Number(price),
        category,
        stock: Number(stock) || 0,
      };

      const book = await Book.create(bookData);

      res.status(201).json({
        success: true,
        message: "Book created successfully",
        data: book,
      });
    } catch (error) {
      console.error("Create book error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create book",
      });
    }
  },

  // PUT /api/books/:id - Update book
  updateBook: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid book ID",
        });
      }

      // Check if book exists
      const existingBook = await Book.findById(id);
      if (!existingBook) {
        return res.status(404).json({
          success: false,
          error: "Book not found",
        });
      }

      // Validate price if provided
      if (updateData.price && updateData.price <= 0) {
        return res.status(400).json({
          success: false,
          error: "Price must be greater than 0",
        });
      }

      const result = await Book.updateById(id, updateData);

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Book not found",
        });
      }

      const updatedBook = await Book.findById(id);

      res.json({
        success: true,
        message: "Book updated successfully",
        data: updatedBook,
      });
    } catch (error) {
      console.error("Update book error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update book",
      });
    }
  },

  // DELETE /api/books/:id - Delete book
  deleteBook: async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid book ID",
        });
      }

      const result = await Book.deleteById(id);

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Book not found",
        });
      }

      res.json({
        success: true,
        message: "Book deleted successfully",
      });
    } catch (error) {
      console.error("Delete book error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete book",
      });
    }
  },

  // GET /api/books/category/:categoryId - Get books by category
  getBooksByCategory: async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const result = await Book.findByCategory(categoryId, options);

      res.json({
        success: true,
        data: result.books,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get books by category error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch books by category",
      });
    }
  },

  // GET /api/books/search - Search books
  searchBooks: async (req, res) => {
    try {
      const { q: searchTerm, page = 1, limit = 10 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          error: "Search term is required",
        });
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const result = await Book.search(searchTerm, options);

      res.json({
        success: true,
        data: result.books,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Search books error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search books",
      });
    }
  },
};

module.exports = bookController;
