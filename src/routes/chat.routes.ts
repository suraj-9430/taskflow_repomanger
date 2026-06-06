import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import ChatMessage from '../models/chatMessage.model';
import { getIO, emitToUser } from '../utils/socket';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// GET messages in channel
router.get('/:channelType/:targetId', async (req: AuthRequest, res: Response) => {
  try {
    const { channelType, targetId } = req.params;
    const messages = await ChatMessage.find({ channelType, targetId })
      .populate('sender', 'firstName lastName email designation avatar role')
      .populate('mentions', 'firstName lastName')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST message in channel (handles socket emits & user mentions notifications)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const sender = req.user?.id;
    const { channelType, targetId, content, mentions = [], quickReply = false } = req.body;

    if (!content || !targetId || !channelType) {
      res.status(400).json({ success: false, message: 'Missing fields' });
      return;
    }

    const chat = new ChatMessage({
      channelType,
      targetId,
      sender,
      content,
      mentions,
      quickReply
    });

    await chat.save();
    const populated = await ChatMessage.findById(chat._id)
      .populate('sender', 'firstName lastName email designation avatar role')
      .populate('mentions', 'firstName lastName');

    // Socket Room Broadcast
    try {
      const io = getIO();
      const room = `${channelType}_${targetId}`;
      io.to(room).emit('new_channel_message', populated);
    } catch (err) {
      console.warn('Socket broadcast warning:', err);
    }

    // Emit live mentions notification to specific users
    if (mentions && mentions.length > 0) {
      mentions.forEach((userId: string) => {
        emitToUser(userId, 'new_mention', {
          senderName: populated?.sender ? `${(populated.sender as any).firstName}` : 'Someone',
          channelType,
          targetId,
          content: content.substring(0, 40)
        });
      });
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
