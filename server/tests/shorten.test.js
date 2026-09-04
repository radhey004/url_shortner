const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const shortenRoutes = require('../routes/shorten');
const redirectRoutes = require('../routes/redirect');

// Mock Redis so tests don't need a real running instance
jest.mock('../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue(true),
  },
}));

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use('/api', shortenRoutes);
  app.use('/', redirectRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('POST /api/shorten', () => {
  it('creates a short URL for a valid longUrl', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://www.example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('shortCode');
    expect(res.body).toHaveProperty('shortUrl');
    expect(res.body.longUrl).toBe('https://www.example.com');
  });

  it('rejects a request with no longUrl', async () => {
    const res = await request(app).post('/api/shorten').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an invalid URL format', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'not-a-valid-url' });
    expect(res.status).toBe(400);
  });
});

describe('GET /:shortCode', () => {
  it('redirects to the original longUrl for a valid shortCode', async () => {
    const createRes = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://www.anthropic.com' });

    const { shortCode } = createRes.body;

    const redirectRes = await request(app).get(`/${shortCode}`);
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.location).toBe('https://www.anthropic.com');
  });

  it('returns 404 for a non-existent shortCode', async () => {
    const res = await request(app).get('/doesNotExist');
    expect(res.status).toBe(404);
  });
});