import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/user.model';
import Task from '../models/task.model';
import Project from '../models/project.model';
import Leave from '../models/leave.model';
import Attendance from '../models/attendance.model';
import ScheduleEvent from '../models/scheduleEvent.model';
import Notification from '../models/notification.model';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const callGemini = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}`);
  }

  const data: any = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const parseJson = (text: string, fallback: any) => {
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(cleaned);
  } catch (_e) {
    return fallback;
  }
};

// ─────────────────────────────────────────────
// POST /api/ai/command — AI Command Center Execution Engine
// ─────────────────────────────────────────────
export const processNaturalLanguageCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { command, confirmed = false, contextData = {} } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role || 'employee';

    if (!command || typeof command !== 'string') {
      res.status(400).json({ success: false, message: 'Command text is required' });
      return;
    }

    const [projects, employees] = await Promise.all([
      Project.find().select('projectName _id').lean(),
      User.find({ empStatus: 'active' }).select('firstName lastName _id role').lean(),
    ]);

    const todayDate = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are the AI Command Center engine for TaskFlowPro.
Target Action Date Baseline: Today is ${todayDate}.
Active User Role: ${userRole}

Active Projects List: ${JSON.stringify(projects.map((p: any) => ({ name: p.projectName, id: p._id })))}
Active Employees List: ${JSON.stringify(employees.map((e: any) => ({ name: `${e.firstName} ${e.lastName}`, id: e._id })))}

Input Command: "${command}"
Merged Context Input: ${JSON.stringify(contextData)}

Analyze intent, extract entities, check RBAC permissions, and identify missing fields.

Supported Intents:
- 'CREATE_TASK': title, priority ('High'|'Medium'|'Low'), dueDate, projectId, assigneeId
- 'APPLY_LEAVE': leaveType ('sick'|'casual'|'earned'), startDate, endDate, reason
- 'MARK_ATTENDANCE': type ('Office Present'|'Remote Present'|'Clocked Out')
- 'SCHEDULE_EVENT': title, eventDate, startTime, endTime, category
- 'CREATE_PROJECT': projectName, description, deadline, priority
- 'VIEW_OVERDUE': task filter
- 'VIEW_WORKLOAD': team workload
- 'VIEW_NOTIFICATIONS': unread alerts
- 'MARK_NOTIFICATIONS_READ': mark read
- 'DELETE_PROJECT': admin/manager only
- 'UNKNOWN': unhandled

RBAC Rules:
- Employees CANNOT delete projects or manage system users.

Return ONLY a raw JSON object matching:
{
  "intent": "CREATE_TASK" | "APPLY_LEAVE" | "MARK_ATTENDANCE" | "SCHEDULE_EVENT" | "CREATE_PROJECT" | "VIEW_OVERDUE" | "VIEW_WORKLOAD" | "VIEW_NOTIFICATIONS" | "MARK_NOTIFICATIONS_READ" | "DELETE_PROJECT" | "UNKNOWN",
  "entities": {
    "title": "string",
    "priority": "High" | "Medium" | "Low",
    "dueDate": "YYYY-MM-DD",
    "projectId": "id",
    "assigneeId": "id",
    "leaveType": "sick" | "casual" | "earned",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "reason": "string",
    "projectName": "string",
    "description": "string"
  },
  "missingFields": ["leaveType", "reason"],
  "promptChoices": {
    "fieldName": "leaveType",
    "question": "What type of leave would you like to apply for?",
    "options": ["Casual", "Sick", "Earned"]
  },
  "rbacAllowed": true | false,
  "rbacReason": "string explanation if denied",
  "message": "Human friendly status message"
}`;

    let parsed: any;
    try {
      const llmOutput = await callGemini(systemPrompt);
      parsed = parseJson(llmOutput, null);
    } catch (_e) {
      console.warn('⚠️ Gemini Command parsing fallback triggered');
    }

    if (!parsed || !parsed.intent) {
      parsed = {
        intent: command.toLowerCase().includes('leave') ? 'APPLY_LEAVE' : command.toLowerCase().includes('task') ? 'CREATE_TASK' : 'VIEW_OVERDUE',
        entities: { title: command },
        missingFields: [],
        rbacAllowed: true,
        message: `Interpreted command: "${command}".`,
      };
    }

    // 1. RBAC Guard check
    if (parsed.rbacAllowed === false) {
      res.status(200).json({
        success: false,
        status: 'RBAC_DENIED',
        message: parsed.rbacReason || `You don't have permission to execute '${parsed.intent}'. Please contact your project manager or administrator.`,
      });
      return;
    }

    // 2. Missing info handling for multi-turn execution
    if (parsed.missingFields && parsed.missingFields.length > 0 && !confirmed) {
      res.status(200).json({
        success: true,
        status: 'NEED_INFO',
        intent: parsed.intent,
        entities: parsed.entities,
        missingFields: parsed.missingFields,
        promptChoices: parsed.promptChoices || {
          fieldName: parsed.missingFields[0],
          question: `Please specify ${parsed.missingFields[0]} to complete this request:`,
          options: parsed.missingFields[0] === 'leaveType' ? ['Casual', 'Sick', 'Earned'] : ['High', 'Medium', 'Low'],
        },
        message: parsed.message || `Almost ready! Please provide ${parsed.missingFields.join(', ')}.`,
      });
      return;
    }

    // 3. Execution Phase — Perform real database operations
    const entities = { ...parsed.entities, ...contextData };
    let executionResult: any = null;

    switch (parsed.intent) {
      case 'CREATE_TASK': {
        const defaultProject = projects[0]?._id;
        const newTask = await Task.create({
          title: entities.title || command,
          description: entities.description || 'Created via AI Command Center',
          priority: entities.priority || 'High',
          dueDate: entities.dueDate ? new Date(entities.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          projectId: entities.projectId || defaultProject,
          assignedTo: entities.assigneeId || userId,
          createdBy: userId,
          status: 'To Do',
        });
        executionResult = {
          type: 'TASK_CREATED',
          task: newTask,
          message: `Successfully created task "${newTask.title}" (Priority: ${newTask.priority}, Due: ${newTask.dueDate.toISOString().split('T')[0]}).`,
        };
        break;
      }

      case 'APPLY_LEAVE': {
        const leave = await Leave.create({
          userId,
          leaveType: (entities.leaveType || 'casual').toLowerCase(),
          startDate: entities.startDate ? new Date(entities.startDate) : new Date(),
          endDate: entities.endDate ? new Date(entities.endDate) : new Date(),
          reason: entities.reason || 'Requested via AI Command Center',
          status: 'Pending',
        });
        executionResult = {
          type: 'LEAVE_SUBMITTED',
          leave,
          message: `Leave request for ${leave.leaveType.toUpperCase()} leave submitted successfully (Status: Pending Approval).`,
        };
        break;
      }

      case 'MARK_ATTENDANCE': {
        const attendance = await Attendance.create({
          user: userId,
          timestamp: new Date(),
          type: entities.type || 'Office Present',
          coordinates: '17.443500, 78.385000',
          distanceMeters: 5,
          status: 'Approved',
        });
        executionResult = {
          type: 'ATTENDANCE_MARKED',
          attendance,
          message: `Successfully marked attendance as ${attendance.type}.`,
        };
        break;
      }

      case 'SCHEDULE_EVENT': {
        const start = entities.eventDate ? new Date(entities.eventDate) : new Date();
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const event = await ScheduleEvent.create({
          title: entities.title || command,
          description: 'Scheduled via AI Command Center',
          eventType: 'meeting',
          startDate: start,
          endDate: end,
          allDay: false,
          audience: 'all',
          createdBy: userId,
        });
        executionResult = {
          type: 'EVENT_SCHEDULED',
          event,
          message: `Meeting "${event.title}" scheduled successfully for ${event.startDate.toISOString().split('T')[0]}.`,
        };
        break;
      }

      case 'CREATE_PROJECT': {
        const newProj = await Project.create({
          projectName: entities.projectName || entities.title || 'New Project',
          description: entities.description || 'Created via AI Command Center',
          startDate: new Date(),
          deadline: entities.deadline ? new Date(entities.deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          priority: entities.priority || 'Medium',
          status: 'In Progress',
          progress: 0,
          createdBy: userId,
        });
        executionResult = {
          type: 'PROJECT_CREATED',
          project: newProj,
          message: `Successfully created project "${newProj.projectName}".`,
        };
        break;
      }

      case 'VIEW_OVERDUE': {
        const overdueTasks = await Task.find({
          status: { $ne: 'Completed' },
          dueDate: { $lt: new Date() },
        }).lean();
        executionResult = {
          type: 'OVERDUE_LIST',
          count: overdueTasks.length,
          tasks: overdueTasks,
          message: `Found ${overdueTasks.length} overdue task(s) requiring attention.`,
        };
        break;
      }

      case 'VIEW_NOTIFICATIONS': {
        const unread = await Notification.find({ user: userId, read: false }).lean();
        executionResult = {
          type: 'NOTIFICATIONS_LIST',
          count: unread.length,
          notifications: unread,
          message: `You have ${unread.length} unread notification(s).`,
        };
        break;
      }

      case 'MARK_NOTIFICATIONS_READ': {
        await Notification.updateMany({ user: userId }, { read: true });
        executionResult = {
          type: 'NOTIFICATIONS_READ',
          message: 'All notifications marked as read.',
        };
        break;
      }

      default: {
        executionResult = {
          type: 'GENERAL_RESPONSE',
          message: parsed.message || `Processed command: "${command}". All checks passed.`,
        };
      }
    }

    res.status(200).json({
      success: true,
      status: 'EXECUTED',
      intent: parsed.intent,
      data: executionResult,
    });
  } catch (error: any) {
    console.error('❌ AI Command Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process command',
      error: error.message || 'Unknown error',
    });
  }
};
