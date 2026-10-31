import amqp from 'amqplib';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/user.model';
import Project from '../models/project.model';
import ProcessedEvent from '../models/processedEvent.model';
import { DLX_EXCHANGE, DEAD_LETTER_QUEUE, publishToQueue } from '../utils/rabbitmq';
import { config } from '../config';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.email.user || process.env.EMAIL_USER,
    pass: config.email.pass || process.env.EMAIL_PASS,
  },
});

const QUEUE_NAME = 'project_assigned_queue';
const TASK_QUEUE_NAME = 'task_assigned_queue';
const STATUS_UPDATE_QUEUE_NAME = 'task_status_updated_queue';
const MAX_RETRIES = 3;

let isShuttingDown = false;
let inFlightTasks = 0;
let channel: any = null;
let connection: any = null;

export const setWorkerChannel = (ch: any): void => {
  channel = ch;
};

/**
 * Handles incoming messages with duplicate-resistant idempotency and backoff retries (PDF Section 11, 12)
 */
export const handleMessageWithIdempotency = async (
  msg: amqp.ConsumeMessage | null,
  queueName: string,
  handler: (payload: any) => Promise<void>
): Promise<void> => {
  if (!msg || !channel) return;

  if (isShuttingDown) {
    // Requeue message if worker is undergoing shutdown
    channel.nack(msg, false, true);
    return;
  }

  inFlightTasks++;

  let eventId = '';
  let retryCount = 0;
  let payload: any = null;

  try {
    const rawContent = JSON.parse(msg.content.toString());

    // Normalize envelope format
    if (rawContent && rawContent.eventId && rawContent.payload) {
      eventId = rawContent.eventId;
      retryCount = rawContent.retryCount || 0;
      payload = rawContent.payload;
    } else {
      // Legacy envelope fallback
      eventId = msg.properties.messageId || `legacy_${Date.now()}_${Math.random()}`;
      retryCount = 0;
      payload = rawContent;
    }

    // 1️⃣ Idempotency Check (PDF Section 12)
    const existingEvent = await ProcessedEvent.findOne({ eventId });
    if (existingEvent && existingEvent.status === 'completed') {
      console.log(`🛡️ [Worker] Event ${eventId} was already completed. Acknowledging duplicate and skipping.`);
      channel.ack(msg);
      inFlightTasks--;
      return;
    }

    // 2️⃣ Record processing state in MongoDB
    await ProcessedEvent.findOneAndUpdate(
      { eventId },
      {
        $set: {
          eventType: queueName,
          status: 'processing',
          retryCount,
          metadata: typeof payload === 'object' ? payload : { raw: payload },
        },
      },
      { upsert: true, new: true }
    );

    // 3️⃣ Execute side effect (Email dispatch)
    await handler(payload);

    // 4️⃣ Mark as completed and acknowledge
    await ProcessedEvent.findOneAndUpdate(
      { eventId },
      {
        $set: {
          status: 'completed',
          processedAt: new Date(),
        },
      }
    );

    channel.ack(msg);
    console.log(`✅ [Worker] Event ${eventId} processed and acknowledged.`);
  } catch (error: any) {
    console.error(`❌ [Worker] Error processing message on ${queueName} (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);

    if (retryCount >= MAX_RETRIES) {
      console.error(`☠️ [Worker] Exhausted retries for event ${eventId}. Routing to Dead Letter Queue.`);
      if (eventId) {
        await ProcessedEvent.findOneAndUpdate(
          { eventId },
          { $set: { status: 'failed', errorMessage: error.message } }
        ).catch(() => {});
      }
      // Negative acknowledgement without requeue triggers Dead Letter Exchange
      channel.nack(msg, false, false);
    } else {
      // Re-publish with exponential backoff delay (avoid immediate busy spin loop)
      const delayMs = Math.pow(2, retryCount) * 1000;
      console.log(`⏳ [Worker] Backing off event ${eventId} for ${delayMs}ms before retry...`);

      channel.ack(msg); // Ack current message from queue

      setTimeout(async () => {
        await publishToQueue(queueName, payload, {
          eventId,
          eventType: queueName,
          retryCount: retryCount + 1,
        });
      }, delayMs);
    }
  } finally {
    inFlightTasks--;
  }
};

export const startWorker = async (): Promise<void> => {
  try {
    const mongoUri = config.mongodbUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tradefinance';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for Worker');

    const amqpUrl = config.rabbitmq.url || process.env.RABBITMQ_URL || 'amqp://localhost';
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();

    // Declare DLX and DLQ
    await channel.assertExchange(DLX_EXCHANGE, 'direct', { durable: true });
    await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await channel.bindQueue(DEAD_LETTER_QUEUE, DLX_EXCHANGE, 'dead_letter_routing_key');

    // Assert main queues with DLX linkage
    const queueOptions = {
      durable: true,
      deadLetterExchange: DLX_EXCHANGE,
      deadLetterRoutingKey: 'dead_letter_routing_key',
    };

    await channel.assertQueue(QUEUE_NAME, queueOptions);
    console.log(`📥 Subscribed to queue: ${QUEUE_NAME}`);
    channel.consume(QUEUE_NAME, (msg: any) => handleMessageWithIdempotency(msg, QUEUE_NAME, processProjectEmailTask));

    await channel.assertQueue(TASK_QUEUE_NAME, queueOptions);
    console.log(`📥 Subscribed to queue: ${TASK_QUEUE_NAME}`);
    channel.consume(TASK_QUEUE_NAME, (msg: any) => handleMessageWithIdempotency(msg, TASK_QUEUE_NAME, processTaskEmailTask));

    await channel.assertQueue(STATUS_UPDATE_QUEUE_NAME, queueOptions);
    console.log(`📥 Subscribed to queue: ${STATUS_UPDATE_QUEUE_NAME}`);
    channel.consume(STATUS_UPDATE_QUEUE_NAME, (msg: any) => handleMessageWithIdempotency(msg, STATUS_UPDATE_QUEUE_NAME, processStatusUpdateEmailTask));

    setupGracefulShutdown();
  } catch (error) {
    console.error('❌ Worker failed to start:', error);
  }
};

const setupGracefulShutdown = (): void => {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 [Worker] Received ${signal}. Starting graceful shutdown...`);

    const timeout = setTimeout(() => {
      console.warn('⚠️ [Worker] Forced shutdown timeout reached (10s). Terminating.');
      process.exit(1);
    }, 10000);

    try {
      while (inFlightTasks > 0) {
        console.log(`⏳ [Worker] Waiting for ${inFlightTasks} in-flight tasks to complete...`);
        await new Promise((res) => setTimeout(res, 500));
      }

      if (channel && typeof channel.close === 'function') await channel.close();
      if (connection && typeof connection.close === 'function') await connection.close();
      await mongoose.disconnect();

      clearTimeout(timeout);
      console.log('✅ [Worker] Clean shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('❌ [Worker] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

const processProjectEmailTask = async (data: { projectId: string; projectName: string; assignees?: string[]; assigneeIds?: string[] }) => {
  const { projectName } = data;
  const rawAssignees = data.assignees || data.assigneeIds || [];
  const assigneeIds = rawAssignees.map((a: any) => (typeof a === 'object' && a._id ? a._id.toString() : a.toString()));

  if (!assigneeIds || assigneeIds.length === 0) return;

  const users = await User.find({ _id: { $in: assigneeIds } });
  for (const user of users) {
    const mailOptions = {
      from: `"TaskFlow Pro" <${config.email.user || process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `New Project Assignment: ${projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px;">
            <h2 style="color: #333;">Hello ${user.firstName},</h2>
            <p style="font-size: 16px; color: #555;">You have been assigned to a new project: <strong>${projectName}</strong></p>
          </div>
        </div>
      `,
    };
    try {
      await transporter.sendMail(mailOptions);
    } catch (err: any) {
      console.warn(`[Worker] Mail transport notice for ${user.email}:`, err.message);
    }
  }
};

const processTaskEmailTask = async (data: { taskId: string; taskTitle: string; assigneeId: string; projectId: string }) => {
  const { taskTitle, assigneeId, projectId } = data;
  if (!assigneeId) return;

  const user = await User.findById(assigneeId);
  if (!user) return;

  const project = await Project.findById(projectId);
  const projectName = project ? project.projectName : 'Active Project';

  const mailOptions = {
    from: `"TaskFlow Pro" <${config.email.user || process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `New Task Assigned: ${taskTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px;">
          <h2 style="color: #333;">Hello ${user.firstName},</h2>
          <p style="font-size: 16px; color: #555;">You have been assigned to a task in <strong>${projectName}</strong>: <strong>${taskTitle}</strong></p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err: any) {
    console.warn(`[Worker] Mail transport notice for ${user.email}:`, err.message);
  }
};

const processStatusUpdateEmailTask = async (data: {
  taskId: string;
  taskTitle: string;
  oldStatus: string;
  newStatus: string;
  assigneeName: string;
  creatorEmail: string;
  creatorName: string;
}) => {
  const { taskTitle, oldStatus, newStatus, assigneeName, creatorEmail, creatorName } = data;
  if (!creatorEmail) return;

  const mailOptions = {
    from: `"TaskFlow Pro" <${config.email.user || process.env.EMAIL_USER}>`,
    to: creatorEmail,
    subject: `Task Status Updated: ${taskTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px;">
          <h2 style="color: #333;">Hello ${creatorName},</h2>
          <p>Status changed from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong> by <strong>${assigneeName}</strong>.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err: any) {
    console.warn(`[Worker] Mail transport notice for ${creatorEmail}:`, err.message);
  }
};

// Start worker only when run as main script
if (require.main === module) {
  startWorker();
}
