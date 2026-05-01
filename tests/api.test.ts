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
          if (prompt.startsWith('Fact check:')) {
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

process.env.GEMINI_API_KEY = 'test-api-key-for-vitest';
process.env.MAPS_API_KEY = 'test-maps-key';
process.env.ADMIN_PASSWORD = 'testpassword';
process.env.NODE_ENV = 'test';

const { app } = await import('../src/server.ts');

describe('ELECTRA API Integration', () => {
  it('GET /api/health returns 200 with status OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('POST /api/eligibility — age 20 Indian is eligible', async () => {
    const res = await request(app)
      .post('/api/eligibility')
      .send({ state: 'Delhi', age: 20, citizenship: 'Indian' });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body).toHaveProperty('voterIdLink');
  });

  it('POST /api/eligibility — negative age returns 400', async () => {
    const res = await request(app)
      .post('/api/eligibility')
      .send({ state: 'Delhi', age: -5, citizenship: 'Indian' });
    expect(res.status).toBe(400);
  });

  it('POST /api/mythbust — returns valid verdict', async () => {
    const res = await request(app)
      .post('/api/mythbust')
      .send({ claim: 'Rumour about EVM tampering' });
    expect(res.status).toBe(200);
    expect(['TRUE', 'FALSE', 'MISLEADING']).toContain(res.body.verdict);
  });

  it('POST /api/quiz — returns 5 questions', async () => {
    const res = await request(app)
      .post('/api/quiz')
      .send({ topic: 'ECI' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(5);
  });

  it('GET /api/timeline — returns 10 stages starting with Announcement', async () => {
    const res = await request(app).get('/api/timeline');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);
    expect(res.body[0].stage).toBe('Announcement');
    expect(res.body[0]).toHaveProperty('law');
  });

  it('GET /api/admin/stats — valid password returns stats object', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('x-admin-password', 'testpassword');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('queries');
    expect(res.body).toHaveProperty('mythBusts');
  });
});
