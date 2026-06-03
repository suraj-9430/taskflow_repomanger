import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `You are the TaskFlow Pro AI assistant — an intelligent co-pilot embedded in an enterprise workforce management platform. Your role is to help employees, managers, and admins manage tasks, projects, attendance, and team workload more effectively.

The platform has three roles: Admin, Manager, and Employee. It tracks:
- Tasks with statuses: To Do, In Progress, Completed
- Projects with deadlines and progress percentage
- GPS-based attendance: Office Present, Remote Present, Clocked Out
- Forward trade finance contracts with currency pairs and lifecycle management

You can:
- Summarize and analyze workload from task/project data
- Break down complex tasks into 4-6 actionable subtasks
- Suggest task prioritization based on due dates and priorities
- Help draft task titles, descriptions, and project plans
- Answer HR and project management questions
- Give productivity tips tailored to the user context

Keep responses concise, practical, and action-oriented. Use bullet points for lists. Be warm but professional.`;

/**
 * Calls the Gemini REST API using native fetch (Node 18+).
 * No external HTTP library needed.
 */
const callGemini = async (
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemInstruction?: string
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const payload: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Gemini API error (${response.status}):`, errorBody);
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error('❌ Gemini API raw response missing text:', JSON.stringify(data, null, 2));
    throw new Error('No response generated from Gemini');
  }

  return text;
};

// ─────────────────────────────────────────────
// POST /api/ai/chat  — Conversational AI chat
// ─────────────────────────────────────────────
export const chatWithAI = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    // Build conversation contents for Gemini
    // We map history directly and then append the new user message.
    const contents = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Always append the current user message at the end
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const reply = await callGemini(contents, SYSTEM_PROMPT);

    res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('❌ AI Chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI response',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// POST /api/ai/breakdown  — Task breakdown generator
// ─────────────────────────────────────────────
export const breakdownTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({ success: false, message: 'Task title is required' });
      return;
    }

    const prompt = `You are a project management AI assistant. Given the following task, generate a practical checklist of 5-7 subtasks/steps needed to complete it.

Task Title: ${title}
Task Description: ${description || 'No description provided'}

Rules:
- Return ONLY a JSON array of strings (e.g., ["Step 1", "Step 2", ...])
- Each step should be actionable and specific
- Keep each step concise (under 100 characters)
- Order steps logically from start to finish
- Do NOT include any other text, markdown, or code fences — just the raw JSON array`;

    const contents = [
      { role: 'user', parts: [{ text: prompt }] },
    ];

    const reply = await callGemini(contents);

    // Parse the JSON array from the response
    let steps: string[];
    try {
      // Clean up the response — Gemini may wrap it in markdown code blocks
      const cleaned = reply
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();
      steps = JSON.parse(cleaned);

      if (!Array.isArray(steps)) {
        throw new Error('Response is not an array');
      }
    } catch (_parseError) {
      // Fallback: split by newlines if JSON parsing fails
      steps = reply
        .split('\n')
        .map((line: string) => line.replace(/^[\d\-*.)]+\s*/, '').trim())
        .filter((line: string) => line.length > 0)
        .slice(0, 7);
    }

    res.status(200).json({ success: true, data: steps });
  } catch (error) {
    console.error('❌ AI Breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate task breakdown',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
