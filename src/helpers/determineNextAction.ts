import { useAppState } from '../state/store';
import { availableActions } from './availableActions';
import { Attempt } from '../state/currentTask';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { errorMap, extractIDs, format } from './format';
import { fetchInference } from './fetchCompletion';

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
You are a resilient and curious individual.

You will be be given a goal to reach and a current view of the world.
You will also be given previous actions that you have taken.

You will be asked to select an action, and rationalize it in terms of your previous actions.
`;

export async function determineNextAction(
  taskInstructions: string,
  previousTasks: any[],
  simplifiedDOM: string,
  MAX_ATTEMPTS = Infinity,
  notifyError?: (error: string) => void,
  completion = fetchInference
) {
  const model = useAppState.getState().settings.selectedModel;
  const prompt = formatPrompt(taskInstructions, simplifiedDOM);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const messages = chatMessages(previousTasks, prompt);

    try {
      const response = await completion(model, messages);
      const {
        prompt_eval_count: prompt_tokens,
        eval_count: completion_tokens,
        message,
        ...body
      }: OllamaChatResponse = await response.json();

      if("error" in body) throw body.error

      return {
        usage: { prompt_tokens, completion_tokens },
        prompt,
        response: message?.content?.trim(),
        attempt: format(simplifiedDOM).parse(JSON.parse(message.content), { errorMap }),
      };
    } catch (error) {
      notifyError && notifyError(`${error}`);
      console.error(error);
    }
    
  }

  throw new Error(
    `Failed to complete query after ${MAX_ATTEMPTS} attempts. Please try again later.`
  );
}

export const formatPrompt = (
  taskInstructions: string,
  pageContents: string
) => `# Current view of the world:
${pageContents}

# Here is what you are supposed to do:
> ${taskInstructions}

# Now, reveal your \`rationale\` as you select your next \`action\` of the following type:

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

function chatMessages(previousTasks: any[], prompt: string) {
  return [
    ...previousTasks
      .map(({ action, prompt }) => [
        { role: 'user', content: prompt },
        { role: 'assistant', content: JSON.stringify(action) },
      ])
      .flat(),
    { role: 'system', content: systemMessage },
    { role: 'user', content: prompt },
  ];
}

export type Message = {
  role: string;
  content: string;
};


