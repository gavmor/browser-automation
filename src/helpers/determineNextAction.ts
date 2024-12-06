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

const formattedActions = availableActions
  .map((action, i) => {
    const args = action.args
      .map((arg) => `${arg.name}: ${arg.type}`)
      .join(', ');
    return `${i + 1}. ${action.name}(${args}): ${action.description}`;
  })
  .join('\n');

const systemMessage = `
You are a browser automation assistant.

You can use the following tools:

${formattedActions}

You will be be given a task to perform and the current state of the DOM. You will also be given previous actions that you have taken. You may retry a failed action up to one time.
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
    const response = await fetchCompletion(model, messages);
    const data: OllamaChatResponse = await response.json();
    console.log("data:", data)


    return {
      usage: {
        prompt_tokens: data.prompt_eval_count,
        completion_tokens: data.eval_count
      },
      prompt,
      response:
        data.message?.content?.trim(),
      action: {
        name: "click",
        thought: data.message?.content?.trim(),
        args: { elementId: 42, value: "bar" }
      } as Action
    };
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

export const ActionFormat = z.object({
  name: z.string(),
  thought: z.string(),
  args: z.object({
    elementID: z.number(),
    value: z.string(),
  }),
});

async function fetchCompletion(model: string, messages: Message[]) {
  return await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stream: false,
      messages,
      model,
      format: ActionFormat
    })
  })
}