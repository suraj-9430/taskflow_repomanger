import amqp from 'amqplib';

let connection: any;
let channel: any;

export const connectRabbitMQ = async () => {
  try {
    const amqpUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();
    console.log('✅ Connected to RabbitMQ');
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error);
  }
};

export const getChannel = (): any => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

export const publishToQueue = async (queueName: string, data: any) => {
  try {
    if (!channel) {
      console.warn('RabbitMQ channel not available, attempting to connect...');
      await connectRabbitMQ();
    }
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
    console.log(`📤 Message sent to queue ${queueName}`);
  } catch (error) {
    console.error(`❌ Failed to publish message to queue ${queueName}:`, error);
  }
};
