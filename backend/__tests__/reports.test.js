import request from 'supertest';
import app from '../server.js';

describe('Reports API Security', () => {
  it('should block access to /api/reports without a token', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.statusCode).toEqual(403);
  });

  it('should block access to /api/reports with an invalid token', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.statusCode).toEqual(401);
  });

  it('should block access to /api/student-reports without a token', async () => {
    const res = await request(app).get('/api/student-reports');
    expect(res.statusCode).toEqual(403);
  });

  it('should block access to /api/student-reports with an invalid token', async () => {
    const res = await request(app)
      .get('/api/student-reports')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.statusCode).toEqual(401);
  });
});
