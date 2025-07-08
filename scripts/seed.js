require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'DB_NAME';

async function seedDatabase() {
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db(dbName);
        
        // Clear existing data
        await db.collection('categories').deleteMany({});
        await db.collection('books').deleteMany({});
        await db.collection('users').deleteMany({});
        await db.collection('orders').deleteMany({});
        
        console.log('Cleared existing data');
        
        // Create admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const adminUser = await db.collection('users').insertOne({
            name: 'Admin User',
            email: 'admin@schoolplus.com',
            password: hashedPassword,
            role: 'admin',
            cart: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        console.log('Created admin user');
        
        // Create categories
        const categories = [
            {
                name: 'Science Fiction',
                description: 'Futuristic and speculative fiction exploring advanced science and technology',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Fantasy',
                description: 'Magical worlds and mythical creatures',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Non-Fiction',
                description: 'Real-world topics and educational content',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Mystery',
                description: 'Suspenseful stories with puzzles to solve',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Romance',
                description: 'Love stories and romantic adventures',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Biography',
                description: 'Life stories of remarkable people',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'History',
                description: 'Historical events and civilizations',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Self-Help',
                description: 'Personal development and improvement',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        
        const categoryResults = await db.collection('categories').insertMany(categories);
        const categoryIds = Object.values(categoryResults.insertedIds);
        
        console.log('Created categories');
        
        // Create books
        const books = [
            // Science Fiction
            {
                title: 'Dune',
                author: 'Frank Herbert',
                description: 'A science fiction novel about politics and power on a desert planet.',
                price: 450,
                category: categoryIds[0], // Science Fiction
                stock: 15,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: "Ender's Game",
                author: 'Orson Scott Card',
                description: 'A young boy is trained to save humanity from alien invasion.',
                price: 380,
                category: categoryIds[0], // Science Fiction
                stock: 12,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Neuromancer',
                author: 'William Gibson',
                description: 'A cyberpunk classic that explores artificial intelligence and virtual reality.',
                price: 410,
                category: categoryIds[0], // Science Fiction
                stock: 8,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Foundation',
                author: 'Isaac Asimov',
                description: 'The first book in the epic Foundation series about a galactic empire.',
                price: 390,
                category: categoryIds[0], // Science Fiction
                stock: 10,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'The Martian',
                author: 'Andy Weir',
                description: 'An astronaut stranded on Mars fights for survival.',
                price: 420,
                category: categoryIds[0], // Science Fiction
                stock: 20,
                createdAt: new Date(),
                updatedAt: new Date()
            },

            // Fantasy
            {
                title: "Harry Potter and the Sorcerer's Stone",
                author: 'J.K. Rowling',
                description: 'A young wizard discovers his magical heritage.',
                price: 500,
                category: categoryIds[1], // Fantasy
                stock: 25,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'The Hobbit',
                author: 'J.R.R. Tolkien',
                description: 'Bilbo Baggins goes on an unexpected adventure.',
                price: 420,
                category: categoryIds[1], // Fantasy
                stock: 18,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'The Name of the Wind',
                author: 'Patrick Rothfuss',
                description: 'The story of a magically gifted young man and his journey.',
                price: 470,
                category: categoryIds[1], // Fantasy
                stock: 14,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'A Game of Thrones',
                author: 'George R.R. Martin',
                description: 'Political intrigue and fantasy in the Seven Kingdoms.',
                price: 520,
                category: categoryIds[1], // Fantasy
                stock: 16,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'The Way of Kings',
                author: 'Brandon Sanderson',
                description: 'Epic fantasy featuring unique magic systems and world-building.',
                price: 550,
                category: categoryIds[1], // Fantasy
                stock: 12,
                createdAt: new Date(),
                updatedAt: new Date()
            },

            // Non-Fiction
            {
                title: 'Sapiens',
                author: 'Yuval Noah Harari',
                description: 'A brief history of humankind.',
                price: 390,
                category: categoryIds[2], // Non-Fiction
                stock: 22,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Educated',
                author: 'Tara Westover',
                description: 'A memoir about growing up and self-education.',
                price: 360,
                category: categoryIds[2], // Non-Fiction
                stock: 19,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Atomic Habits',
                author: 'James Clear',
                description: 'A guide to building good habits and breaking bad ones.',
                price: 340,
                category: categoryIds[2], // Non-Fiction
                stock: 30,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Thinking, Fast and Slow',
                author: 'Daniel Kahneman',
                description: 'Insights into how the mind makes decisions.',
                price: 430,
                category: categoryIds[2], // Non-Fiction
                stock: 15,
                createdAt: new Date(),
                updatedAt: new Date()
            },

            // Mystery
            {
                title: 'The Girl with the Dragon Tattoo',
                author: 'Stieg Larsson',
                description: 'A journalist and hacker investigate a decades-old disappearance.',
                price: 380,
                category: categoryIds[3], // Mystery
                stock: 13,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Gone Girl',
                author: 'Gillian Flynn',
                description: 'A psychological thriller about a marriage gone wrong.',
                price: 400,
                category: categoryIds[3], // Mystery
                stock: 17,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'The Murder of Roger Ackroyd',
                author: 'Agatha Christie',
                description: 'A classic Hercule Poirot mystery.',
                price: 320,
                category: categoryIds[3], // Mystery
                stock: 11,
                createdAt: new Date(),
                updatedAt: new Date()
            },

            // Romance
            {
                title: 'Pride and Prejudice',
                author: 'Jane Austen',
                description: 'A timeless romance set in Regency England.',
                price: 350,
                category: categoryIds[4], // Romance
                stock: 20,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'The Notebook',
                author: 'Nicholas Sparks',
                description: 'A passionate love story that spans decades.',
                price: 320,
                category: categoryIds[4], // Romance
                stock: 24,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Outlander',
                author: 'Diana Gabaldon',
                description: 'Time travel romance between 20th and 18th century Scotland.',
                price: 480,
                category: categoryIds[4], // Romance
                stock: 14,
                createdAt: new Date(),
                updatedAt: new Date()
            },

            // Biography
            {
                title: 'Steve Jobs',
                author: 'Walter Isaacson',
                description: 'The authorized biography of the Apple co-founder.',
                price: 450,
                category: categoryIds[5], // Biography
                stock: 16,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Becoming',
                author: 'Michelle Obama',
                description: 'The intimate memoir of the former First Lady.',
                price: 420,
                category: categoryIds[5], // Biography
                stock: 21,
                createdAt: new Date(),
                updatedAt: new Date()
            },

            // History
            {
                title: 'The Guns of August',
                author: 'Barbara Tuchman',
                description: 'A detailed account of the first month of World War I.',
                price: 380,
                category: categoryIds[6], // History
                stock: 9,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'A People\'s History of the United States',
                author: 'Howard Zinn',
                description: 'American history from the perspective of ordinary people.',
                price: 440,
                category: categoryIds[6], // History
                stock: 12,
                createdAt: new Date(),
                updatedAt: new Date()
            },

            // Self-Help
            {
                title: 'The 7 Habits of Highly Effective People',
                author: 'Stephen R. Covey',
                description: 'A principle-centered approach to personal and professional effectiveness.',
                price: 360,
                category: categoryIds[7], // Self-Help
                stock: 28,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'How to Win Friends and Influence People',
                author: 'Dale Carnegie',
                description: 'Timeless advice on building relationships and communication.',
                price: 340,
                category: categoryIds[7], // Self-Help
                stock: 25,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'The Power of Now',
                author: 'Eckhart Tolle',
                description: 'A guide to spiritual enlightenment and mindfulness.',
                price: 330,
                category: categoryIds[7], // Self-Help
                stock: 18,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        
        await db.collection('books').insertMany(books);
        console.log('Created books');
        
        // Create a test user
        const testUser = await db.collection('users').insertOne({
            name: 'John Doe',
            email: 'john@example.com',
            password: await bcrypt.hash('password123', 10),
            role: 'user',
            cart: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        console.log('Created test user');
        
        console.log('\n✅ Database seeded successfully!');
        console.log('\n📋 Default accounts:');
        console.log('👤 Admin: admin@schoolplus.com / admin123');
        console.log('👤 User:  john@example.com / password123');
        console.log(`\n📊 Created:`);
        console.log(`   ${categories.length} categories`);
        console.log(`   ${books.length} books`);
        console.log(`   2 users (1 admin, 1 regular user)`);
        
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await client.close();
    }
}

// Run the seeder
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;