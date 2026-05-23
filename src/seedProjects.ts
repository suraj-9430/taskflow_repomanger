import mongoose from 'mongoose';
import Project from './models/projects.model';
import User from './models/user.model';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradefinance';

const seedProjects = async () => {
  try {
    console.log('Connecting to MongoDB...', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a user to use as createdBy
    const user = await User.findOne({ role: 'admin' });
    if (!user) {
      console.log('No admin user found. Please run seed.ts first to create users.');
      process.exit(1);
    }

    const projectsToInsert = [
      {
        name: 'Sample Project 1',
        description: 'This is a sample project for testing.',
        startDate: new Date(),
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'In Progress' as const,
        priority: 'High' as const,
        progress: 10,
        employeeIds: [user._id],
        createdBy: user._id,
        isActive: true,
      },
      {
        name: 'Sample Project 2',
        description: 'Another sample project.',
        startDate: new Date(),
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: 'On Hold' as const,
        priority: 'Medium' as const,
        progress: 0,
        employeeIds: [],
        createdBy: user._id,
        isActive: true,
      },
    ];

    console.log(`Inserting ${projectsToInsert.length} projects...`);
    for (const projectData of projectsToInsert) {
      const project = new Project(projectData);
      await project.save();
    }

    console.log('Successfully seeded projects!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding projects:', error);
    process.exit(1);
  }
};

seedProjects();