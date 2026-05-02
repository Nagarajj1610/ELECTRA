process.env.GEMINI_API_KEY = 'test-api-key-for-vitest';
process.env.MAPS_API_KEY = 'test-maps-key';
process.env.ADMIN_PASSWORD = 'testpassword';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
process.env.NODE_ENV = 'test';

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
            stream: (async function* () { yield { text: () => 'Mocked ELECTRA response about Indian elections.' }; })(),
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
    translateText: vi.fn().mockResolvedValue([{ translations: [{ translatedText: 'अनुवादित पाठ' }] }]),
  })),
}));

const { app } = await import('../server.ts');

describe('ELECTRA API Tests', () => {
  
  // [integration] tests
  describe('Integration', () => {
    it('GET /api/health returns 200 with status OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
    });

    it('POST /api/eligibility — age 20 Indian is eligible', async () => {
      const res = await request(app)
        .post('/api/eligibility')
        .send({ state: 'Delhi', age: 20, citizenship: 'Indian' });
      expect(res.status).toBe(200);
      expect(res.body.eligible).toBe(true);
    });

    it('POST /api/mythbust — returns valid verdict', async () => {
      const res = await request(app)
        .post('/api/mythbust')
        .send({ claim: 'Rumour about EVM tampering' });
      expect(res.status).toBe(200);
      expect(['TRUE', 'FALSE', 'MISLEADING']).toContain(res.body.verdict);
    });

    it('GET /api/admin/stats — unauthorized without password', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });
  });

  // [regression] tests
  describe('Regression', () => {
    it('full flow: chat→eligibility→quiz→mythbust→timeline completes without error', async () => {
      // 1. Chat
      const chatRes = await request(app)
        .post('/api/chat')
        .send({ message: 'Hello', language: 'en', history: [] });
      expect(chatRes.status).toBe(200);

      // 2. Eligibility
      const eligRes = await request(app)
        .post('/api/eligibility')
        .send({ state: 'Delhi', age: 18, citizenship: 'Indian' });
      expect(eligRes.status).toBe(200);

      // 3. Quiz
      const quizRes = await request(app)
        .post('/api/quiz')
        .send({ topic: 'EVM', score: 0 });
      expect(quizRes.status).toBe(200);

      // 4. MythBust
      const mythRes = await request(app)
        .post('/api/mythbust')
        .send({ claim: 'Claim text' });
      expect(mythRes.status).toBe(200);

      // 5. Timeline
      const timeRes = await request(app).get('/api/timeline');
      expect(timeRes.status).toBe(200);
    });
  });

  describe('Failure Simulation', () => {
    it('[regression] returns fallback when Gemini is unavailable', async () => {
      // Mock generateContent to throw for this specific test
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockModel = new GoogleGenerativeAI('').getGenerativeModel({ model: '' });
      vi.mocked(mockModel.generateContent).mockRejectedValueOnce(new Error('Gemini Down'));

      const res = await request(app)
        .post('/api/quiz')
        .send({ topic: 'Politics', score: 0 });
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].question).toBeDefined();
    });

    it('[regression] chat limiter returns 429 after 11 rapid requests', async () => {
      // Send 10 successful requests
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/chat')
          .send({ message: `request ${i}`, language: 'en', history: [] });
      }
      // 11th request must return 429
      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'request 11', language: 'en', history: [] });
      
      expect(res.status).toBe(429);
    }, 15000); // Higher timeout for sequential requests
  });
});
