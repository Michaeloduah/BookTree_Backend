const { MongoClient, ObjectId } = require("mongodb");

// MongoDB connection setup
const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "schoolplus_db";
const client = new MongoClient(uri);

// Helper function to get category collection
async function getCategoryCollection() {
  return client.db(dbName).collection("categories");
}

// Helper function to get book collection
async function getBookCollection() {
  return client.db(dbName).collection("books");
}

class Category {
  constructor({ name, description, isActive, _id }) {
    this.name = name;
    this.description = description;
    this.isActive = isActive !== undefined ? isActive : true;
    if (_id) this._id = _id;
  }

  static async create(categoryData) {
    const collection = await getCategoryCollection();
    const category = {
      ...categoryData,
      isActive:
        categoryData.isActive !== undefined ? categoryData.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await collection.insertOne(category);
    return new Category({ ...category, _id: result.insertedId });
  }

  static async findAll(filter = {}) {
    const collection = await getCategoryCollection();
    const categories = await collection
      .find(filter)
      .sort({ name: 1 })
      .toArray();
    return categories.map((category) => new Category(category));
  }

  static async findById(id) {
    const collection = await getCategoryCollection();
    const category = await collection.findOne({ _id: new ObjectId(id) });
    return category ? new Category(category) : null;
  }

  static async findByName(name) {
    const collection = await getCategoryCollection();
    const category = await collection.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    return category ? new Category(category) : null;
  }

  static async updateById(id, updateData) {
    const collection = await getCategoryCollection();
    const update = {
      ...updateData,
      updatedAt: new Date(),
    };
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    return result;
  }

  static async deleteById(id) {
    const collection = await getCategoryCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result;
  }

  static async countBooks(categoryId) {
    const bookCollection = await getBookCollection();
    return await bookCollection.countDocuments({ category: categoryId });
  }
}

// Controller functions
const categoryController = {
  // GET /api/categories - Get all categories
  getAllCategories: async (req, res) => {
    try {
      const { active } = req.query;
      let filter = {};

      // Filter by active status if specified
      if (active !== undefined) {
        filter.isActive = active === "true";
      }

      const categories = await Category.findAll(filter);

      // Add book count for each category
      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          const bookCount = await Category.countBooks(category._id);
          return {
            ...category,
            bookCount,
          };
        })
      );

      res.json({
        success: true,
        data: categoriesWithCount,
      });
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch categories",
      });
    }
  },

  // GET /api/categories/:id - Get single category
  getCategoryById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }

      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }

      // Add book count
      const bookCount = await Category.countBooks(id);

      res.json({
        success: true,
        data: {
          ...category,
          bookCount,
        },
      });
    } catch (error) {
      console.error("Get category error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch category",
      });
    }
  },

  // POST /api/categories - Create new category
  createCategory: async (req, res) => {
    try {
      const { name, description, isActive } = req.body;

      // Validation
      if (!name) {
        return res.status(400).json({
          success: false,
          error: "Category name is required",
        });
      }

      // Check if category with same name already exists
      const existingCategory = await Category.findByName(name);
      if (existingCategory) {
        return res.status(409).json({
          success: false,
          error: "Category with this name already exists",
        });
      }

      const categoryData = {
        name: name.trim(),
        description: description || "",
        isActive: isActive !== undefined ? isActive : true,
      };

      const category = await Category.create(categoryData);

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create category",
      });
    }
  },

  // PUT /api/categories/:id - Update category
  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }

      // Check if category exists
      const existingCategory = await Category.findById(id);
      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }

      // If updating name, check for duplicates
      if (updateData.name && updateData.name !== existingCategory.name) {
        const duplicateCategory = await Category.findByName(updateData.name);
        if (duplicateCategory) {
          return res.status(409).json({
            success: false,
            error: "Category with this name already exists",
          });
        }
        updateData.name = updateData.name.trim();
      }

      const result = await Category.updateById(id, updateData);

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }

      const updatedCategory = await Category.findById(id);

      res.json({
        success: true,
        message: "Category updated successfully",
        data: updatedCategory,
      });
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update category",
      });
    }
  },

  // DELETE /api/categories/:id - Delete category
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { force } = req.query;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }

      // Check if category has books
      const bookCount = await Category.countBooks(id);
      if (bookCount > 0 && force !== "true") {
        return res.status(400).json({
          success: false,
          error: `Cannot delete category with ${bookCount} books. Use force=true to delete anyway.`,
          bookCount,
        });
      }

      const result = await Category.deleteById(id);

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }

      // If force delete, also remove category reference from books
      if (force === "true" && bookCount > 0) {
        const bookCollection = await getBookCollection();
        await bookCollection.updateMany(
          { category: id },
          { $unset: { category: "" } }
        );
      }

      res.json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete category",
      });
    }
  },

  // PUT /api/categories/:id/toggle - Toggle category active status
  toggleCategoryStatus: async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }

      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }

      const newStatus = !category.isActive;
      await Category.updateById(id, { isActive: newStatus });

      const updatedCategory = await Category.findById(id);

      res.json({
        success: true,
        message: `Category ${
          newStatus ? "activated" : "deactivated"
        } successfully`,
        data: updatedCategory,
      });
    } catch (error) {
      console.error("Toggle category status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to toggle category status",
      });
    }
  },
};

module.exports = categoryController;
