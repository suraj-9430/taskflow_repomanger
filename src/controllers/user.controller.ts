import { Request, Response } from 'express';
import User from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

// In-memory store for OTPs (For production, use Redis or MongoDB)
const otpStore = new Map<string, { otp: string, expiresAt: number }>();

// @desc    Get all users
// @route   GET /api/users
// @access  Public
export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find().select('firstName middleName lastName email role dateOfJoining empStatus country userId  designation');
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get only active employees (role=employee, empStatus=active)
// @route   GET /api/users/employees
// @access  Public
export const getEmployees = async (_req: Request, res: Response) => {
  try {
    const employees = await User.find({ role: 'employee', empStatus: 'active' })
      .select('firstName lastName email designation empStatus userId')
      .sort({ firstName: 1 });
    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching employees',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const countuserbyrole = async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string;
     
    console.log('Role received in query:', role);
    
    const count = await User.countDocuments({ role });
    res.status(200).json({
      success: true,
      role,
      count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error counting users by role',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


export const countactiveuser = async (req: Request, res: Response) => {
  try {
    const empStatus = req.query.empStatus as string;
     
    console.log('Role received in query:', empStatus);
    
    const count = await User.countDocuments({ empStatus });
    res.status(200).json({
      success: true,
      empStatus,
      count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error counting users by role',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Public
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Public
export const createUser = async (req: Request, res: Response) => {
  try {
    const { firstName, middleName, lastName, contact, email, role, dateOfJoining, employmentType, empStatus, department, designation, country, password, } = req.body;
    const emptyToUndefined = (value: string | undefined) =>
      value === '' || value === null ? undefined : value;
    const user = await User.create({
      firstName: emptyToUndefined(firstName),
      middleName: emptyToUndefined(middleName),
      lastName: emptyToUndefined(lastName),
      contactNumber: emptyToUndefined(contact),
      email: emptyToUndefined(email),
      role: emptyToUndefined(role),
      dateOfJoining: emptyToUndefined(dateOfJoining),
      employmentType: emptyToUndefined(employmentType),
      empStatus: emptyToUndefined(empStatus),
      department: emptyToUndefined(department),
      designation: emptyToUndefined(designation),
      country: emptyToUndefined(country),
      password: password ? await bcrypt.hash(password, 10) : undefined,
    });
    if (user.userId) {
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        userId: user.userId,
      });
    }
    else {
      res.status(500).json({
        success: false,
        message: 'Error creating user',
      });
    }
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Public
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, empStatus } = req.body;

    const updateData: any = {};
    if (role) updateData.role = role;
    if (empStatus) updateData.empStatus = empStatus;

    const user = await User.findOneAndUpdate(
      { userId: req.params.id },
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Public
// export const deleteUser = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const user = await User.findByIdAndDelete(req.params.id);

//     if (!user) {
//       res.status(404).json({
//         success: false,
//         message: 'User not found',
//       });
//       return;
//     }

//     res.status(200).json({
//       success: true,
//       message: 'User deleted successfully',
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting user',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//   }
// };


export const fetchuserlimit = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;

    const skip = (page - 1) * limit;

    const totalUsers = await User.countDocuments();

    const users = await User.find()
      .skip(skip)
      .limit(limit);

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
      return;
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Password is Incorrect',
      });
      return;
    }

    if (user.empStatus !== 'active') {
      res.status(403).json({
        success: false,
        message: 'Your account is disabled. Please contact your admin section.',
      });
      return;
    }

    // Sign JWT
    const payload = {
      user: {
        id: user._id,
        role: user.role,
      },
    };

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
    
    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        
        // Set cookie
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        res.status(200).json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Logout user
// @route   POST /api/users/logout
// @access  Public
export const logoutUser = async (_req: Request, res: Response): Promise<void> => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

// @desc    Forgot Password - Generate and send OTP
// @route   POST /api/users/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Please provide an email' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      res.status(200).json({ success: true, message: 'If the email exists, an OTP will be sent.' });
      return;
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with 10 minutes expiration
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 mins
    });

    // Send email using Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"TaskFlow Pro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #ff9900; text-align: center;">TaskFlow Pro</h2>
          <h3 style="text-align: center;">Password Reset Request</h3>
          <p>We received a request to reset your password. Use the OTP below to complete the process. This OTP is valid for 10 minutes.</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">${otp}</span>
          </div>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">TaskFlow Pro &copy; ${new Date().getFullYear()}</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log(`\n\n========================================`);
    console.log(`✉️  EMAIL SENT WITH OTP FOR ${email}: ${otp}`);
    console.log(`========================================\n\n`);

    res.status(200).json({
      success: true,
      message: 'OTP has been sent to your email successfully.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Reset Password with OTP
// @route   POST /api/users/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      res.status(400).json({ success: false, message: 'Please provide email, OTP, and new password' });
      return;
    }

    const storedData = otpStore.get(email);

    if (!storedData) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      return;
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      res.status(400).json({ success: false, message: 'OTP has expired' });
      return;
    }

    if (storedData.otp !== otp) {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
      return;
    }

    // OTP is valid, hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Clear OTP
    otpStore.delete(email);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};