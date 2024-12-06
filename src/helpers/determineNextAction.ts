import { useAppState } from '../state/store';
import { availableActions } from './availableActions';
import { Action } from '../state/currentTask';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type OllamaChatResponse = {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
};

const systemMessage = `
You are a browser automation assistant.

You will be be given a task to perform and the current state of the DOM.
You will also be given previous actions that you have taken.
You may retry a failed action up to one time.

Reveal your \`rationale\` as you select your next \`action\` of the following type:

\`\`\`
type Attempt =
  | {
    rationale: string;
    action: "fail" | "finish" // Indicates the task is finished or impossible.
  }
  | {
      rationale: string;
      action: 'click'; // Clicks on an element
      args: { elementId: number };
    }
  | {
      rationale: string;
      action: 'setValue'; // Focuses on and sets the value of an input element
      args: { elementId: number; value: string };
    };
\`\`\`
`;

export async function determineNextAction(
  taskInstructions: string,
  previousTasks: any[],
  simplifiedDOM: string,
  maxAttempts = 3,
  notifyError?: (error: string) => void
) {
  const model = useAppState.getState().settings.selectedModel;
  const prompt = formatPrompt(taskInstructions, simplifiedDOM);
  for (let i = 0; i < maxAttempts; i++) {
    const messages = chatMessages(previousTasks, prompt);
    try {
      const response = await fetchCompletion(model, messages);
      const data: OllamaChatResponse = await response.json();
      
      if("error" in data) throw data.error

      return {
        usage: {
          prompt_tokens: data.prompt_eval_count,
          completion_tokens: data.eval_count
        },
        prompt,
        response:
          data.message?.content?.trim(),
        attempt: format.parse(JSON.parse(data.message.content))
      };
    } catch(error) {
      notifyError && notifyError(`ERROR! ${error} ${error?.message}"`);
      console.log("error:", error);
    }
  }


  throw new Error(
    `Failed to complete query after ${maxAttempts} attempts. Please try again later.`
  );
}

export const formatPrompt = (
  taskInstructions: string,
  pageContents: string
) => `The user requests the following task:

${taskInstructions}

Current page contents:
${pageContents}`;

function chatMessages(previousTasks: any[], prompt: string) {
  return [
    ...previousTasks.map(({ action, prompt }) => ([
      { role: 'user', content: prompt },
      { role: 'assistant', content: action }
    ])).flat(),
    { role: 'system', content: systemMessage, },
    { role: 'user', content: prompt },
  ];
}

type Message = {
  role: string;
  content: string;
};

export const format = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('fail'),
    rationale: z.string(),
  }),
  z.object({
    action: z.literal('finish'),
    rationale: z.string(),
  }),
  z.object({
    action: z.literal('click'),
    rationale: z.string(),
    args: z.object({
      elementId: z.number(),
    }),
  }),
  z.object({
    action: z.literal('setValue'),
    rationale: z.string(),
    args: z.object({
      elementId: z.number(),
      value: z.string(),
    }),
  }),
]);

async function fetchCompletion(model: string, messages: Message[]) {
  return await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stream: false,
      messages,
      model,
      format: zodToJsonSchema(format),
    })
  })
}