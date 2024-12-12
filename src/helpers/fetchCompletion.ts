import zodToJsonSchema from "zod-to-json-schema";
import { Message } from "./determineNextAction";
import { format } from "./format";

export async function fetchInference(model: string, messages: Message[]) {
    return await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream: false,
          messages,
          model,
          format: zodToJsonSchema(format(lastMessageContent(messages))),
          options: {
            temperature: 2,
            num_ctx: 16384,
          },
        }),
      });
}
const lastMessageContent = (messages: Message[]): string => messages[messages.length - 1].content;
