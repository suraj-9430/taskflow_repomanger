import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  firstName: string;
  middleName: string;
  lastName: string; 
  email: string;
  password: string;
  role: 'admin' | 'employee' | 'manager';
  contactNumber: string;
  dateOfJoining: Date;
  employmentType: 'full-time' | 'intern' | 'contract';
  empStatus: 'active' | 'inactive' | 'hold';
  country:string;
  department: string;
  designation: string;  
  isActive: boolean;
  avatar?: string;
  bio?: string;
  settings?: {
    notifications: {
      emailUpdates: boolean;
      pushAlerts: boolean;
      taskAssigned: boolean;
      statusChanged: boolean;
      deadlineAlerts: boolean;
      weeklySummary: boolean;
    };
    preferences: {
      themeColor: string;
      density: string;
      soundEffects: boolean;
      sidebarExpanded: boolean;
      animationsEnabled: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, 'First Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    middleName: {
      type: String,
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, ' Last Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'employee', 'manager'],
      default: 'employee',
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      minlength: [10, 'Contact number must be at least 10 digits'],
      maxlength: [15, 'Contact number cannot exceed 15 digits'],
    },
    dateOfJoining: {
      type: Date,
      default: Date.now,
    },
    employmentType: {
      type: String,
      enum: ['full-time', 'intern', 'contract'],
      default: 'full-time',
    },
    empStatus: {
      type: String,
      enum: ['active', 'inactive','hold'],
      default: 'active',
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },  
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },  
    isActive: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    },
    bio: {
      type: String,
      default: '',
    },
    settings: {
      notifications: {
        emailUpdates: { type: Boolean, default: true },
        pushAlerts: { type: Boolean, default: false },
        taskAssigned: { type: Boolean, default: true },
        statusChanged: { type: Boolean, default: true },
        deadlineAlerts: { type: Boolean, default: true },
        weeklySummary: { type: Boolean, default: false }
      },
      preferences: {
        themeColor: { type: String, default: 'amber' },
        density: { type: String, default: 'cozy' },
        soundEffects: { type: Boolean, default: true },
        sidebarExpanded: { type: Boolean, default: true },
        animationsEnabled: { type: Boolean, default: true }
      }
    }
  },
  {
    timestamps: true,
  }
);

// Index for faster queries (email already indexed via unique: true)
userSchema.index({ role: 1 });
userSchema.pre('validate', async function (next) {
  if (this.isNew && !this.userId) {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(10 + Math.random() * 90);
    this.userId = `${year}${randomNum}`;
  }
  next();
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
