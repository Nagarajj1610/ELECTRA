import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock Google AI and Cloud modules BEFORE importing app
vi.mock('@google/generative-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/generative-ai')>();
  return {
    ...actual, // re-export HarmCategory, HarmBlockThreshold, SafetySetting, etc.
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        startChat: vi.fn().mockReturnValue({
          sendMessageStream: vi.fn().mockResolvedValue({
            stream: (async function* () { yield { text: () => 'Test response' }; })(),
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

// Set required env vars before importing app
process.env.GEMINI_API_KEY = 'test-key-for-vitest';
process.env.MAPS_API_KEY = 'test-maps-key';
process.env.ADMIN_PASSWORD = 'testpassword';
process.env.NODE_ENV = 'test';

// Import app AFTER mocks are set up
const { app } = await import('../server.ts');

describe('ELECTRA API — Health [Integration]', () => {
  it('GET /api/health returns 200 OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

describe('ELECTRA API — Eligibility [Integration]', () => {
  it('POST /api/eligibility — age 20 Indian should be eligible', async () => {
    const res = await request(app)
      .post('/api/eligibility')
      .send({ state: 'Maharashtra', age: 20, citizenship: 'Indian' });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body).toHaveProperty('voterIdLink');
  });

  it('POST /api/eligibility — age 17 should NOT be eligible', async () => {
    const res = await request(app)
      .post('/api/eligibility')
      .send({ state: 'Delhi', age: 17, citizenship: 'Indian' });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
  });

  it('POST /api/eligibility — NRI should NOT be eligible', async () => {
    const res = await request(app)
      .post('/api/eligibility')
      .send({ state: 'Gujarat', age: 25, citizenship: 'NRI' });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
  });

  it('POST /api/eligibility — invalid body (non-numeric age) returns 400', async () => {
    const res = await request(app)
      .post('/api/eligibility')
      .send({ state: 'Delhi', age: 'not-a-number', citizenship: 'Indian' });
    expect(res.status).toBe(400);
  });
});

describe('ELECTRA API — Timeline [Integration]', () => {
  it('GET /api/timeline returns 10 stages', async () => {
    const res = await request(app).get('/api/timeline');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);
    expect(res.body[0]).toHaveProperty('stage');
    expect(res.body[0]).toHaveProperty('law');
  });
});

describe('ELECTRA API — Quiz [Integration]', () => {
  it('POST /api/quiz returns 5 questions', async () => {
    const res = await request(app)
      .post('/api/quiz')
      .send({ topic: 'Constitution', score: 0 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toHaveProperty('question');
    expect(res.body[0]).toHaveProperty('options');
    expect(res.body[0]).toHaveProperty('correct');
    expect(res.body[0]).toHaveProperty('explanation');
  });
});

describe('ELECTRA API — Myth Buster [Integration]', () => {
  it('POST /api/mythbust — valid claim returns verdict enum', async () => {
    const res = await request(app)
      .post('/api/mythbust')
      .send({ claim: 'You can vote online in India' });
    expect(res.status).toBe(200);
    expect(['TRUE', 'FALSE', 'MISLEADING']).toContain(res.body.verdict);
    expect(res.body).toHaveProperty('explanation');
  });

  it('POST /api/mythbust — empty claim returns 400', async () => {
    const res = await request(app)
      .post('/api/mythbust')
      .send({ claim: '' });
    expect(res.status).toBe(400); // Zod min(1) validation → global error handler → 400
  });
});

describe('ELECTRA API — Maps [Integration]', () => {
  it('POST /api/maps/lookup — known pincode returns constituency', async () => {
    const res = await request(app)
      .post('/api/maps/lookup')
      .send({ pincode: '110001' });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('Delhi');
    expect(res.body).toHaveProperty('lokSabha');
  });

  it('POST /api/maps/lookup — invalid pincode (not 6 digits) returns 400', async () => {
    const res = await request(app)
      .post('/api/maps/lookup')
      .send({ pincode: '123' });
    expect(res.status).toBe(400);
  });
});

describe('ELECTRA API — Admin [Integration]', () => {
  it('GET /api/admin/stats — wrong password returns 401', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('x-admin-password', 'wrong');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/stats — correct password returns stats', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('x-admin-password', 'testpassword');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('queries');
    expect(res.body).toHaveProperty('mythBusts');
  });
});

describe('ELECTRA API — Translation [Integration]', () => {
  it('POST /api/translate — English to Hindi', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Hello', target: 'hi' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('translated');
  });

  it('POST /api/translate — invalid target returns 400', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Hello', target: 'fr' }); // 'fr' not in enum
    expect(res.status).toBe(400);
  });
});
