// Regression suite: re-run after every feature change to catch breakage
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock all Google AI and Cloud services before app import
vi.mock('@google/generative-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/generative-ai')>();
  return {
    ...actual,
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        startChat: vi.fn().mockReturnValue({
          sendMessageStream: vi.fn().mockResolvedValue({
            stream: (async function* () { yield { text: () => 'Mocked ELECTRA response.' }; })(),
          }),
        }),
        generateContent: vi.fn().mockImplementation(({ contents }: any) => {
          const prompt = contents?.[0]?.parts?.[0]?.text || '';
          if (prompt.includes('Fact-check this claim:')) {
            return Promise.resolve({
              response: { text: () => JSON.stringify({ verdict: 'FALSE', explanation: 'This is a myth.', source: 'ECI' }) },
            });
          }
          return Promise.resolve({
            response: {
              text: () => JSON.stringify([
                { question: 'Q1', options: ['A', 'B', 'C', 'D'], correct: 0, explanation: 'E1' },
                { question: 'Q2', options: ['A', 'B', 'C', 'D'], correct: 1, explanation: 'E2' },
                { question: 'Q3', options: ['A', 'B', 'C', 'D'], correct: 2, explanation: 'E3' },
                { question: 'Q4', options: ['A', 'B', 'C', 'D'], correct: 3, explanation: 'E4' },
                { question: 'Q5', options: ['A', 'B', 'C', 'D'], correct: 0, explanation: 'E5' },
              ]),
            },
          });
        }),
      }),
    })),
  };
});

vi.mock('@google-cloud/translate', () => ({
  TranslationServiceClient: vi.fn().mockImplementation(() => ({
    translateText: vi.fn().mockResolvedValue([{ translations: [{ translatedText: 'नमस्ते' }] }]),
  })),
}));

process.env.GEMINI_API_KEY = 'test-key';
process.env.MAPS_API_KEY = 'test-key';
process.env.ADMIN_PASSWORD = 'testpassword';
process.env.NODE_ENV = 'test';

const { app } = await import('../server.ts');

describe('ELECTRA Full Flow [Regression][E2E]', () => {
  it('should complete the full user journey: chat → eligibility → quiz → mythbust → timeline', async () => {
    // 1. Chat
    const chatRes = await request(app)
      .post('/api/chat')
      .send({ message: 'How do I vote?' });
    expect(chatRes.status).toBe(200);

    // 2. Eligibility
    const eligibilityRes = await request(app)
      .post('/api/eligibility')
      .send({ state: 'Delhi', age: 25, citizenship: 'Indian' });
    expect(eligibilityRes.status).toBe(200);
    expect(eligibilityRes.body.eligible).toBe(true);

    // 3. Quiz
    const quizRes = await request(app)
      .post('/api/quiz')
      .send({ topic: 'Constitution' });
    expect(quizRes.status).toBe(200);
    expect(quizRes.body).toHaveLength(5);

    // 4. Myth Buster
    const mythRes = await request(app)
      .post('/api/mythbust')
      .send({ claim: 'EVMs can be hacked' });
    expect(mythRes.status).toBe(200);
    expect(mythRes.body.verdict).toBe('FALSE');

    // 5. Timeline
    const timelineRes = await request(app).get('/api/timeline');
    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body).toHaveLength(10);
  });
});
