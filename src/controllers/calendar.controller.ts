import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import ScheduleEvent from '../models/scheduleEvent.model';
import Task from '../models/task.model';
import Project from '../models/project.model';
import Leave from '../models/leave.model';

const getRange = (start?: string, end?: string) => {
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

const buildTaskQuery = (userId: string, role: string, startDate: Date, endDate: Date) => {
  const query: any = {
    dueDate: { $gte: startDate, $lte: endDate },
  };

  if (role === 'employee') {
    query.assignedTo = userId;
  }

  return query;
};

const buildProjectQuery = (userId: string, role: string, startDate: Date, endDate: Date) => {
  const query: any = {
    $or: [
      { startDate: { $gte: startDate, $lte: endDate } },
      { deadline: { $gte: startDate, $lte: endDate } },
    ],
  };

  if (role === 'employee') {
    query.assignees = userId;
  }

  return query;
};

const buildLeaveQuery = (userId: string, role: string, startDate: Date, endDate: Date) => {
  const query: any = {
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    status: 'Approved',
  };

  if (role === 'employee') {
    query.userId = userId;
  }

  return query;
};

const buildScheduleQuery = (userId: string, role: string, startDate: Date, endDate: Date) => {
  const query: any = {
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };

  if (role !== 'admin') {
    query.$or = [
      { audience: 'all' },
      { audience: role },
      { participants: userId },
      { createdBy: userId },
    ];
  }

  return query;
};

export const getCalendarEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || '';
    const role = req.user?.role || 'employee';
    const { startDate, endDate } = getRange(req.query.start as string, req.query.end as string);

    const [scheduleEvents, tasks, projects, leaves] = await Promise.all([
      ScheduleEvent.find(buildScheduleQuery(userId, role, startDate, endDate))
        .populate('participants', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .sort({ startDate: 1 }),
      Task.find(buildTaskQuery(userId, role, startDate, endDate))
        .populate('assignedTo', 'firstName lastName')
        .populate('projectId', 'projectName')
        .sort({ dueDate: 1 }),
      Project.find(buildProjectQuery(userId, role, startDate, endDate))
        .populate('assignees', 'firstName lastName')
        .sort({ deadline: 1 }),
      Leave.find(buildLeaveQuery(userId, role, startDate, endDate))
        .populate('userId', 'firstName lastName')
        .sort({ startDate: 1 }),
    ]);

    const events = [
      ...scheduleEvents.map((event) => ({
        id: String(event._id),
        source: 'schedule',
        title: event.title,
        description: event.description || '',
        startDate: event.startDate,
        endDate: event.endDate,
        allDay: event.allDay,
        type: event.eventType,
        badge: 'Schedule',
        audience: event.audience,
        participants: event.participants,
        createdBy: event.createdBy,
      })),
      ...tasks.map((task) => ({
        id: String(task._id),
        source: 'task',
        title: task.title,
        description: task.description || '',
        startDate: task.dueDate,
        endDate: task.dueDate,
        allDay: true,
        type: task.priority?.toLowerCase() || 'reminder',
        badge: `Task · ${task.status}`,
        meta: {
          taskId: task.taskId,
          projectName: (task.projectId as any)?.projectName || 'Unknown Project',
          assignee: task.assignedTo
            ? `${(task.assignedTo as any).firstName} ${(task.assignedTo as any).lastName}`
            : 'Unassigned',
        },
      })),
      ...projects.flatMap((project) => [
        {
          id: `${project._id}_start`,
          source: 'project',
          title: `${project.projectName} starts`,
          description: project.description || '',
          startDate: project.startDate,
          endDate: project.startDate,
          allDay: true,
          type: 'shift',
          badge: 'Project Start',
          meta: {
            projectId: project.projectId,
            status: project.status,
            priority: project.priority,
          },
        },
        {
          id: `${project._id}_deadline`,
          source: 'project',
          title: `${project.projectName} deadline`,
          description: project.description || '',
          startDate: project.deadline,
          endDate: project.deadline,
          allDay: true,
          type: project.priority?.toLowerCase() || 'review',
          badge: `Project · ${project.status}`,
          meta: {
            projectId: project.projectId,
            progress: project.progress,
          },
        },
      ]),
      ...leaves.map((leave) => ({
        id: String(leave._id),
        source: 'leave',
        title: `${(leave.userId as any)?.firstName || 'Employee'} ${(leave.userId as any)?.lastName || ''} on ${leave.leaveType} leave`.trim(),
        description: leave.reason || '',
        startDate: leave.startDate,
        endDate: leave.endDate,
        allDay: true,
        type: 'reminder',
        badge: 'Approved Leave',
        meta: {
          leaveType: leave.leaveType,
          status: leave.status,
        },
      })),
    ].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch calendar events', error: error.message });
  }
};

export const createScheduleEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, eventType, startDate, endDate, allDay, audience, participants } = req.body;

    if (!title || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Title, startDate, and endDate are required' });
      return;
    }

    const event = await ScheduleEvent.create({
      title,
      description,
      eventType: eventType || 'meeting',
      startDate,
      endDate,
      allDay: !!allDay,
      audience: audience || 'all',
      participants: participants || [],
      createdBy: req.user?.id,
    });

    const populated = await ScheduleEvent.findById(event._id)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create schedule event', error: error.message });
  }
};

export const updateScheduleEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await ScheduleEvent.findById(req.params.id);

    if (!existing) {
      res.status(404).json({ success: false, message: 'Schedule event not found' });
      return;
    }

    const canManage = req.user?.role === 'admin' || String(existing.createdBy) === req.user?.id;
    if (!canManage) {
      res.status(403).json({ success: false, message: 'You can only edit schedule events you created.' });
      return;
    }

    const updated = await ScheduleEvent.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update schedule event', error: error.message });
  }
};

export const deleteScheduleEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await ScheduleEvent.findById(req.params.id);

    if (!existing) {
      res.status(404).json({ success: false, message: 'Schedule event not found' });
      return;
    }

    const canManage = req.user?.role === 'admin' || String(existing.createdBy) === req.user?.id;
    if (!canManage) {
      res.status(403).json({ success: false, message: 'You can only delete schedule events you created.' });
      return;
    }

    await ScheduleEvent.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Schedule event deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete schedule event', error: error.message });
  }
};
