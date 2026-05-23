import amqp from 'amqplib';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import User from '../models/user.model';
import Project from '../models/project.model';

// Force Node.js to resolve DNS hostnames to IPv4 first (resolves Render's IPv6 ENETUNREACH issues)
dns.setDefaultResultOrder('ipv4first');

// Custom DNS lookup that filters out IPv6 and forces IPv4
const ipv4Lookup = (hostname: string, options: any, callback: any) => {
  return dns.lookup(hostname, { ...options, family: 4 }, callback);
};

dotenv.config();

const QUEUE_NAME = 'project_assigned_queue';
const TASK_QUEUE_NAME = 'task_assigned_queue';

// Nodemailer transport configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  lookup: ipv4Lookup, // Force IPv4 only dynamically
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // Avoid certificate validation issues in cloud environments
  },
  connectionTimeout: 10000, // Time out after 10 seconds instead of hanging forever
  greetingTimeout: 10000,
  socketTimeout: 10000
} as any);

const startWorker = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tradefinance';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for Worker');

    // Connect to RabbitMQ
    const amqpUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    const connection = await amqp.connect(amqpUrl);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log(`📥 Waiting for messages in queue: ${QUEUE_NAME}...`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        try {
          const data = JSON.parse(msg.content.toString());
          console.log(`📨 Received project assignment event for project: ${data.projectName}`);
          
          await processProjectEmailTask(data);
          
          channel.ack(msg);
          console.log('✅ Project Email task processed and acknowledged.');
        } catch (error) {
          console.error('❌ Error processing message:', error);
        }
      }
    });

    await channel.assertQueue(TASK_QUEUE_NAME, { durable: true });
    console.log(`📥 Waiting for messages in queue: ${TASK_QUEUE_NAME}...`);

    channel.consume(TASK_QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        try {
          const data = JSON.parse(msg.content.toString());
          console.log(`📨 Received task assignment event for task: ${data.taskTitle}`);
          
          await processTaskEmailTask(data);
          
          channel.ack(msg);
          console.log('✅ Task Email task processed and acknowledged.');
        } catch (error) {
          console.error('❌ Error processing task message:', error);
        }
      }
    });
  } catch (error) {
    console.error('❌ Worker failed to start:', error);
  }
};

const processProjectEmailTask = async (data: { projectId: string, projectName: string, assigneeIds: string[] }) => {
  const { projectName, assigneeIds } = data;
  
  console.log(`🔍 [Worker] Processing project email task for "${projectName}". Assignees requested:`, assigneeIds);

  if (!assigneeIds || assigneeIds.length === 0) {
    console.log(`⚠️ [Worker] No assignees found in the event payload. Skipping email.`);
    return;
  }

  try {
    // Fetch user emails from the DB
    console.log(`🔍 [Worker] Fetching users from DB...`);
    const users = await User.find({ _id: { $in: assigneeIds } });
    console.log(`🔍 [Worker] Successfully fetched ${users.length} users from MongoDB.`);

    if (users.length === 0) {
      console.log(`⚠️ [Worker] None of the assignee IDs matched a user in the database.`);
      return;
    }
    
    for (const user of users) {
      console.log(`📧 [Worker] Preparing to send email to ${user.email} (SMTP User: ${process.env.EMAIL_USER})...`);
      const mailOptions = {
        from: `"TaskFlow Pro" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `New Project Assignment: ${projectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px;">
              <h2 style="color: #333;">Hello ${user.firstName},</h2>
              <p style="font-size: 16px; color: #555;">You have been assigned to a new project:</p>
              <div style="background-color: #eef2f5; padding: 15px; border-left: 4px solid #f39c12; margin: 20px 0;">
                <h3 style="margin: 0; color: #2c3e50;">${projectName}</h3>
              </div>
              <p style="font-size: 16px; color: #555;">Please log in to your dashboard to view the project details and tasks.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}" style="display: inline-block; padding: 10px 20px; background-color: #f39c12; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 10px;">Go to Dashboard</a>
              <p style="font-size: 14px; color: #999; margin-top: 30px;">Best regards,<br>TaskFlow Pro Team</p>
            </div>
          </div>
        `,
      };

      console.log(`📧 [Worker] Dispatching SMTP request via Nodemailer to ${user.email}...`);
      await transporter.sendMail(mailOptions);
      console.log(`✅ [Worker] SMTP delivery success! Email sent to ${user.email}`);
    }
  } catch (dbOrMailError) {
    console.error(`❌ [Worker] Failure inside processProjectEmailTask:`, dbOrMailError);
    throw dbOrMailError; // Bubble up to be caught by consumer catch block
  }
};

const processTaskEmailTask = async (data: { taskId: string, taskTitle: string, assigneeId: string, projectId: string }) => {
  const { taskTitle, assigneeId, projectId } = data;
  
  console.log(`🔍 [Worker] Processing task email task for "${taskTitle}". Assignee ID requested:`, assigneeId);

  if (!assigneeId) {
    console.log(`⚠️ [Worker] No assignee ID provided. Skipping task email.`);
    return;
  }

  try {
    console.log(`🔍 [Worker] Fetching user details for task assignment...`);
    const user = await User.findById(assigneeId);
    if (!user) {
      console.log(`⚠️ [Worker] Assignee ID ${assigneeId} not found in database.`);
      return;
    }

    console.log(`🔍 [Worker] Fetching project ${projectId} for context...`);
    const project = await Project.findById(projectId);
    const projectName = project ? project.projectName : 'Unknown Project';

    console.log(`📧 [Worker] Preparing to send task email to ${user.email}...`);
    const mailOptions = {
      from: `"TaskFlow Pro" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `New Task Assigned: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px;">
            <h2 style="color: #333;">Hello ${user.firstName},</h2>
            <p style="font-size: 16px; color: #555;">You have been assigned to a new task in <strong>${projectName}</strong>:</p>
            <div style="background-color: #eef2f5; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0;">
              <h3 style="margin: 0; color: #2c3e50;">${taskTitle}</h3>
            </div>
            <p style="font-size: 16px; color: #555;">Please log in to your dashboard to view the full details and start working.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 10px;">Go to Dashboard</a>
            <p style="font-size: 14px; color: #999; margin-top: 30px;">Best regards,<br>TaskFlow Pro Team</p>
          </div>
        </div>
      `,
    };

    console.log(`📧 [Worker] Dispatching task SMTP request to ${user.email}...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ [Worker] SMTP delivery success! Task Email sent to ${user.email}`);
  } catch (dbOrMailError) {
    console.error(`❌ [Worker] Failure inside processTaskEmailTask:`, dbOrMailError);
    throw dbOrMailError;
  }
};

startWorker();
