import { useAppState } from '../state/store';
import { availableActions } from './availableActions';
import { Attempt } from '../state/currentTask';
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
You are a resilient and curious individual.

You will be be given a goal to reach and a current view of the world.
You will also be given previous actions that you have taken.

You will be asked to select an action, and rationalize it in terms of your previous actions.
`;

export const errorMap = (error: z.ZodIssueOptionalMessage, ctx: z.ErrorMapCtx): { message: string; } => {
  if (error.path[0] === 'action' && error.code === z.ZodIssueCode.invalid_union_discriminator) {
    return { message: `${ctx.data.action} not among ${error.options.join(' | ')}}` }
  }
  return { message: ctx.defaultError };
};

export async function determineNextAction(
  taskInstructions: string,
  previousTasks: any[],
  simplifiedDOM: string,
  MAX_ATTEMPTS = Infinity,
  notifyError?: (error: string) => void
) {
  const model = useAppState.getState().settings.selectedModel;
  const prompt = formatPrompt(taskInstructions, simplifiedDOM);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const messages = chatMessages(previousTasks, prompt);

    try {
      const response = await fetchCompletion(model, messages);
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

type Message = {
  role: string;
  content: string;
};

const extractIDs = (html: string): number[] =>
  Array.from(html.matchAll(/id=["']([^"']+)["']/g))
    .map(match => parseInt(match[1]));

export const format = (markup:string) => z.discriminatedUnion('action', [
  z.object({
    rationale: z.string(),
    action: z.literal('fail'),
  }),
  z.object({
    rationale: z.string(),
    action: z.literal('finish'),
  }),
  z.object({
    rationale: z.string(),
    args: z.object({ elementId: idLiterals(markup) }),
    action: z.literal('click'),
  }),
  z.object({
    rationale: z.string(),
    args: z.object({ elementId: idLiterals(markup), value: z.string() }),
    action: z.literal('setValue'),
  }),
]);

function idLiterals(markup: string): z.ZodUnion<[z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]> {
  return z.union(extractIDs(markup) // https://github.com/colinhacks/zod/issues/3383
    .map(id => z.literal(id)) as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]);
}

async function fetchCompletion(model: string, messages: Message[]) {
  return await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stream: false,
      messages,
      model,
      format: zodToJsonSchema(format(extractMarkupFromPromptToScrapeIDs(messages))),
      options: {
        temperature: 2,
        num_ctx: 16384,
      },
    }),
  });
}
function extractMarkupFromPromptToScrapeIDs(messages: Message[]): string {
  return messages[messages.length - 1].content;
}

