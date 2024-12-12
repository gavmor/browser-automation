import { z } from 'zod';
import { errorMap, extractIDs, format, idLiterals } from './format';
import { describe, it, expect } from '@jest/globals';

describe('format', () => {
  it('should correctly parse a click action', () => {
    const markup = '<div id="1"></div><div id="2"></div>';
    const schema = format(markup);
    const result = schema.safeParse({
      action: 'click',
      rationale: 'Clicking the button',
      args: { elementId: 2 },
    });
    expect(result.success).toBe(true);
  });

  it('should correctly parse a setValue action', () => {
    const markup = '<input id="3" />';
    const schema = format(markup);

    const result = schema.safeParse({
      action: 'setValue',
      rationale: 'Setting the value',
      args: { elementId: 3, value: 'test' },
    });

    expect(result.success).toBe(true);
  });

  it('should correctly parse a finish action', () => {
    const markup = '';
    const schema = format(markup);
    const result = schema.safeParse({
      action: 'finish',
      rationale: 'Finishing',
    });
    expect(result.success).toBe(true);
  });

  it('should correctly parse a fail action', () => {
    const markup = '';
    const schema = format(markup);
    const result = schema.safeParse({
      action: 'fail',
      rationale: 'Failing',
    });
    expect(result.success).toBe(true);
  });

  it('should fail if the action is not valid', () => {
    const markup = '';
    const schema = format(markup);
    const result = schema.safeParse({
      action: 'invalid',
      rationale: 'Invalid action',
    });
    expect(result.success).toBe(false);
  });

  it('should fail if the elementId is not present in the markup for click', () => {
    const markup = '<div id="1"></div>';
    const schema = format(markup);
    const result = schema.safeParse({
      action: 'click',
      rationale: 'Clicking the button',
      args: { elementId: 2 },
    });
    expect(result.success).toBe(false);
  });

  it('should fail if the elementId is not present in the markup for setValue', () => {
    const markup = '<input id="1">';
    const schema = format(markup);
    const result = schema.safeParse({
      action: 'setValue',
      rationale: 'Setting the value',
      args: { elementId: 2, value: 'test' },
    });
    expect(result.success).toBe(false);
  });
});


describe('extractIDs', () => {
  it('should extract IDs from HTML', () => {
    const html = '<div id="1"></div><div id="2"></div>';
    const ids = extractIDs(html);
    expect(ids).toEqual([1, 2]);
  });

  it('should handle no IDs', () => {
    const html = '<div></div>';
    const ids = extractIDs(html);
    expect(ids).toEqual([]);
  });

    it('should handle malformed HTML', () => {
      const html = '<div id="1"><div id="2">';
      const ids = extractIDs(html);
      expect(ids).toEqual([1, 2]);
    });


  it('should extract IDs with different quote types', () => {
    const html = '<div id="1"></div><div id=\'2\'></div>';
    const ids = extractIDs(html);
    expect(ids).toEqual([1, 2]);
  });
});

describe("idLiterals", () => {
    it("should create a union of literal IDs", () => {
      const markup = "<div id='1'></div><div id='2'></div>";
      const literals = idLiterals(markup);
      expect(literals).toBeInstanceOf(z.ZodUnion);
        const parsed1 = literals.safeParse(1)
        expect(parsed1.success).toBe(true)
        const parsed2 = literals.safeParse(2)
        expect(parsed2.success).toBe(true)
        const parsed3 = literals.safeParse(3)
        expect(parsed3.success).toBe(false)
    })
})


describe('errorMap', () => {
  it('should return a custom error message for invalid union discriminator', () => {
    const error = {
      path: ['action'],
      code: z.ZodIssueCode.invalid_union_discriminator,
      options: ['chocolate', 'strawberry', 'vanilla'],
    } as z.ZodIssueOptionalMessage;
    const ctx = {
      data: { action: { "type": "click", "args": { "elementId": 76 } } },
      defaultError: 'Invalid action',
    } as z.ErrorMapCtx;

    const result = errorMap(error, ctx);
    expect(result.message).toBe(
      '{\"type\":\"click\",\"args\":{\"elementId\":76}} not among chocolate | strawberry | vanilla'
    );
  });



  it('should return the default error message for other errors', () => {
    const error = {
      path: ['rationale'],
      code: z.ZodIssueCode.invalid_type,
      expected: 'string',
      received: 'number',
    } as z.ZodIssueOptionalMessage;

    const ctx = {
      defaultError: 'Invalid rationale',
    } as z.ErrorMapCtx;

    const result = errorMap(error, ctx);

    expect(result.message).toBe('Invalid rationale');
  });

  it('should return the default error message if the action is correct but other errors exist', () => {
        const error = {
          path: ['args', 'elementId'], // Deeper path
          code: z.ZodIssueCode.invalid_literal,
          expected: 1,
        } as z.ZodIssueOptionalMessage;

        const ctx = {
          data: { action: 'click' }, // action is VALID
          defaultError: 'Invalid elementId',
        } as z.ErrorMapCtx;

        const result = errorMap(error, ctx);

        expect(result.message).toBe('Invalid elementId');
      });


    it('should return default error for invalid_union_discriminator with wrong path', () => {
      const error = {
        path: ['rationale'], // Wrong path
        code: z.ZodIssueCode.invalid_union_discriminator,
        options: ['click', 'setValue', 'finish', 'fail'],
      } as z.ZodIssueOptionalMessage;
      const ctx = {
        data: { action: 'invalidAction' },
        defaultError: 'Invalid action',
      } as z.ErrorMapCtx;

      const result = errorMap(error, ctx);
      expect(result.message).toBe('Invalid action');
    });

});

