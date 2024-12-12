import { z } from "zod";

export const format = (markup: string) => z.discriminatedUnion('action', [
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

export function idLiterals(markup: string): z.ZodUnion<[z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]> {
  // https://github.com/colinhacks/zod/issues/3383
  return z.union(extractIDs(markup).map(id => z.literal(id)) as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]);
}

export const extractIDs = (html: string): number[] => Array.from(html.matchAll(/id=["']([^"']+)["']/g))
  .map(match => Number(match[1]));

export function errorMap(error: z.ZodIssueOptionalMessage, ctx: z.ErrorMapCtx): { message: string; } {
  if (error.path[0] === 'action' && error.code === z.ZodIssueCode.invalid_union_discriminator) {
    return { message: `${JSON.stringify(ctx.data.action)} not among ${error.options.join(' | ')}` };
  }
  return { message: ctx.defaultError };
};



