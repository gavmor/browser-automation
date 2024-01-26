import {
  Configuration,
  CreateCompletionResponseUsage,
  OpenAIApi,
} from 'openai';
import { useAppState } from '../state/store';
import { availableActions } from './availableActions';
import { ParsedResponseSuccess } from './parseResponse';

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

This is an example of an action:

<Justification>Since I found the shoes I'm looking for, I will click the button labeled "Add to Cart"</Justification>
<Action>click(223)</Action>

You must always include the <Justification> and <Action> open/close tags or else your response will be marked as invalid.`;
console.log(systemMessage)
export async function determineNextAction(
  taskInstructions: string,
  previousActions: ParsedResponseSuccess[],
  simplifiedDOM: string,
  maxAttempts = 3,
  notifyError?: (error: string) => void
) {
  const model = useAppState.getState().settings.selectedModel;
  const prompt = formatPrompt(taskInstructions, previousActions, simplifiedDOM);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const messages = chatMessages(previousActions, prompt);
      const response = await fetchCompletion(model, messages);
      const data: OllamaChatResponse = await response.json();

      if (!response.ok) { throw new Error(data.message.content); }

      return {
        usage: {
          prompt_tokens: data.prompt_eval_count,
          completion_tokens: data.eval_count
        },
        prompt,
        response:
          data.message?.content?.trim() + '</Action>',
      };

    } catch (error: any) {
      if (error.message.includes('server error')) {
        notifyError && notifyError(error.message);
      } else {
        throw new Error(error.message);
      }
    }
  }

  throw new Error(
    `Failed to complete query after ${maxAttempts} attempts. Please try again later.`
  );
}

const actionTemplate = ({ action, thought }: ParsedResponseSuccess): string => `<Justification>${thought}</Justification>\n<Action>${action}</Action>`;

export const formatPrompt = (
  taskInstructions: string,
  previousActions: ParsedResponseSuccess[],
  pageContents: string
) => `The user requests the following task:

${taskInstructions}

${!!false && previousActions.length ? `You have already taken the following actions: \n${previousActions.map(actionTemplate).join('\n\n')}\n\n` : ""}
Current page contents:
${pageContents}`;

function chatMessages(previousActions: ParsedResponseSuccess[], prompt: string) {
  return [
    ...previousActions.map(action => ({
      role: 'assistant', content: actionTemplate(action)
    })),
    { role: 'user', content: prompt },
    { role: 'system', content: systemMessage, },
  ];
}

type Message = {
  role: string;
  content: string;
};

async function fetchCompletion(model: string, messages: Message[]) {
  return await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stream: false,
      messages,
      model,
      seed: 42,
      options: {
        top_k: 10,
        // top_p: 0.8,
        num_ctx: 65536,
        // temperature: 1,
        // repeat_penalty: 2,
        // repeat_last_n: -1
      },
    })
  });
}

