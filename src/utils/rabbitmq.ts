import amqp from 'amqplib';
import crypto from 'crypto';
import { config } from '../config';

let connection: any = null;
let channel: any = null;

export const DLX_EXCHANGE = 'taskflow_dlx';
export const DEAD_LETTER_QUEUE = 'taskflow_dead_letter_queue';

export interface EventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  version: '1.0';
  timestamp: string;
  retryCount: number;
  payload: T;
}

export const connectRabbitMQ = async (): Promise<amqp.Channel | null> => {
  try {
    const amqpUrl = config.rabbitmq.url || 'amqp://localhost';
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();

    // 1️⃣ Assert Dead Letter Exchange and Queue (PDF Section 11)
    await channel.assertExchange(DLX_EXCHANGE, 'direct', { durable: true });
    await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await channel.bindQueue(DEAD_LETTER_QUEUE, DLX_EXCHANGE, 'dead_letter_routing_key');

    if (config.nodeEnv !== 'test') {
      console.log('✅ Connected to RabbitMQ with DLX & Dead Letter Queue configured');
    }
    return channel;
  } catch (error) {
    if (config.nodeEnv !== 'test') {
      console.warn('⚠️ Failed to connect to RabbitMQ broker:', (error as Error).message);
    }
    return null;
  }
};

export const isRabbitMQConnected = (): boolean => Boolean(connection && channel);

export const getChannel = (): amqp.Channel => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

/**
 * Publishes durable, persistent messages with a standardized event envelope (PDF Section 11, 12)
 */
export const publishToQueue = async <T = any>(
  queueName: string,
  data: T,
  existingEnvelope?: Partial<EventEnvelope<T>>
): Promise<boolean> => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }
    if (!channel) {
      console.warn(`RabbitMQ unavailable; event for ${queueName} dropped.`);
      return false;
    }

    // Assert main queue with dead-letter forwarding
    await channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: DLX_EXCHANGE,
      deadLetterRoutingKey: 'dead_letter_routing_key',
    });

    const envelope: EventEnvelope<T> = {
      eventId: existingEnvelope?.eventId || crypto.randomUUID(),
      eventType: existingEnvelope?.eventType || queueName,
      version: '1.0',
      timestamp: existingEnvelope?.timestamp || new Date().toISOString(),
      retryCount: existingEnvelope?.retryCount ?? 0,
      payload: data,
    };

    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
      messageId: envelope.eventId,
      timestamp: Date.now(),
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to publish message to queue ${queueName}:`, error);
    return false;
  }
};
