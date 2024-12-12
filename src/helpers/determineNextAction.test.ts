import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { determineNextAction, formatPrompt } from './determineNextAction';
import { format } from './format';
import { z as mock_z } from 'zod';

const mockFetchCompletion = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    return Promise.resolve({ json: () => Promise.resolve({}) } as any)
});

jest.mock('./format', () => ({
    format: jest.fn(() => mock_z.any()),
    extractIDs: jest.fn(),
}));


xdescribe('determineNextAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetchCompletion;
    });

    it('should return the formatted response and usage data', async () => {
        const mockResponse = {
            prompt_eval_count: 10,
            eval_count: 20,
            message: {
                content: JSON.stringify({
                  action: 'click',
                  rationale: 'Clicking the button',
                  args: { elementId: 1 },
                })
            },
          };

        mockFetchCompletion.mockResolvedValue({
            json: () => Promise.resolve(mockResponse) as any,
        });

        const result = await determineNextAction(
            'test instructions',
            [],
            '<div>test</div>',
            1,
            jest.fn()
        );

        expect(result).toEqual({
            usage: { prompt_tokens: 10, completion_tokens: 20 },
            prompt: expect.any(String), // Check prompt formatting separately
            response: JSON.stringify({
              action: 'click',
              rationale: 'Clicking the button',
              args: { elementId: 1 },            }),
            attempt: expect.anything(), // We're mocking the zod parsing
        });
    });

    it('should call notifyError if there is an error', async () => {
        const mockError = new Error('Test error');
        const mockNotifyError = jest.fn();

        mockFetchCompletion.mockRejectedValue(mockError);
        const formattedPrompt = formatPrompt('test instructions', '<div>test</div>');

        try {
          await determineNextAction('test instructions', [], '<div>test</div>', 1, mockNotifyError);
        } catch (error) {
          // Expect error to be thrown, but also ensure correct prompt and error handling happened within
          expect(mockNotifyError).toHaveBeenCalledWith(mockError.toString());
          expect(mockFetchCompletion).toHaveBeenCalledWith('http://localhost:11434/api/chat', expect.objectContaining({
            body: expect.stringContaining(formattedPrompt)
          }))
        }
      });


    it('should throw an error if it fails after max attempts', async () => {
        const mockError = new Error('Test error');
        mockFetchCompletion.mockRejectedValue(mockError);

        await expect(
            determineNextAction(
                'test instructions',
                [],
                '<div>test</div>',
                2,
                jest.fn()
            )
        ).rejects.toThrowError(
            'Failed to complete query after 2 attempts. Please try again later.'
        );
        expect(mockFetchCompletion).toHaveBeenCalledTimes(2);
    });


    it('should format the prompt correctly', () => {
        const instructions = 'Click the button';
        const dom = '<button>Click me</button>';
        const expectedPrompt = `# Current view of the world:
${dom}

# Here is what you are supposed to do:
> ${instructions}

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
        expect(formatPrompt(instructions, dom)).toBe(expectedPrompt);
    });


});


