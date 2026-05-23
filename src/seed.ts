import mongoose from 'mongoose';
import User from './models/user.model';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const usersToInsert = [];

    for (let i = 1; i <= 40; i++) {
      usersToInsert.push({
        firstName: `First${i}`,
        lastName: `Last${i}`,
        email: `seed_${Date.now()}_${i}@example.com`,
        password: 'password123',
        userId: `${Math.floor(Date.now() / 1000).toString().slice(-4)}${i.toString().padStart(2, '0')}`,
        role: i % 10 === 0 ? 'manager' : (i % 5 === 0 ? 'admin' : 'employee'),
        contactNumber: `987654321${(i % 10).toString()}`,
        employmentType: i % 3 === 0 ? 'contract' : 'full-time',
        empStatus: 'active',
        department: i % 2 === 0 ? 'Engineering' : 'Sales',
        designation: i % 2 === 0 ? 'Software Engineer' : 'Sales Executive',
        country: 'India',
        isActive: true,
      });
    }

    console.log(`Inserting ${usersToInsert.length} users...`);
    // Insert using Model.create so the pre-validate hook fires for userId
    for (const userData of usersToInsert) {
      const user = new User(userData);
      await user.save();
    }
    
    console.log('Successfully seeded 40 users!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
