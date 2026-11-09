import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { createClient } from 'redis';

assert.ok(process.env.HISTORY_TEST_MONGO_URI, 'Set HISTORY_TEST_MONGO_URI to a test MongoDB server.');
assert.ok(process.env.HISTORY_TEST_REDIS_URL, 'Set HISTORY_TEST_REDIS_URL to a disposable Redis server.');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'course-history-verification-secret';
const database = `course_history_test_${randomUUID().replaceAll('-', '')}`;
const prefix = `${database}:`;
const { default: app } = await import('../server.js');
const { default: Student } = await import('../models/Student.js');
const { default: MdbFile } = await import('../models/MdbFile.js');
const { default: User } = await import('../models/User.js');
const { signTokenForUser } = await import('../auth.model.js');
const { careerCache, createCareerCache } = await import('../services/careerCache.service.js');
const redis = createClient({ url: process.env.HISTORY_TEST_REDIS_URL });
let server;
try {
  await mongoose.connect(process.env.HISTORY_TEST_MONGO_URI, { dbName: database });
  await redis.connect();
  const connection = {
    time: () => redis.time(),
    eval: (script, options) => redis.eval(script, { ...options, keys: options.keys.map(key => prefix + key) }),
  };
  Object.assign(careerCache, createCareerCache({ client: async () => connection, search: async () => ({ jobs: [{ jobId: 'fixture-job', title: 'Fixture job', applyLink: 'https://example.com/job' }], cursor: null }) }));
  await redis.lPush(`${prefix}job_history:ITW`, 'legacy leaked DFK keyword');
  await MdbFile.create([
    { datasetName: 'previous', originalName: 'previous.mdb', filePath: '/test/previous.mdb', fileSize: 1, status: 'Processed', processedDate: new Date('2025-01-01') },
    { datasetName: 'current', originalName: 'current.mdb', filePath: '/test/current.mdb', fileSize: 1, status: 'Processed', processedDate: new Date(), isCurrentSemester: true },
  ]);
  await Student.create({ ID_Pelajar: 'DFK-A', Kursus: 'ITW', sourceDataset: 'previous' });
  await Student.create([
    { ID_Pelajar: 'DFK-A', Kursus: 'DFK', sourceDataset: 'current' },
    { ID_Pelajar: 'DFK-B', Kursus: ' *dfk* ', sourceDataset: 'current' },
    { ID_Pelajar: 'ITW-C', Kursus: 'ITW', sourceDataset: 'current' },
  ]);
  const tokens = {};
  for (const studentId of ['DFK-A', 'DFK-B', 'ITW-C']) {
    const user = await User.create({ email: `${studentId.toLowerCase()}@example.test`, password: 'unused-fixture-hash', role: 'user', studentId });
    tokens[studentId] = signTokenForUser(user);
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/careers`;
  async function request(studentId, path) {
    const response = await fetch(base + path, { headers: { Authorization: `Bearer ${tokens[studentId]}` } });
    return { status: response.status, ...await response.json() };
  }
  const searched = await request('DFK-A', '/search?q=cloud%20support');
  const dfkHistory = await request('DFK-B', '/history');
  const itwHistory = await request('ITW-C', '/history');
  console.log(`DFK A search resolved ${searched.department}; DFK B history=${JSON.stringify(dfkHistory.keywords)}; ITW C history=${JSON.stringify(itwHistory.keywords)}`);
  assert.equal(searched.status, 200);
  assert.equal(searched.department, 'DFK', 'Current DFK membership must control history writes.');
  assert.deepEqual(dfkHistory.keywords, ['cloud support'], 'Two DFK students must share history.');
  assert.deepEqual(itwHistory.keywords, [], 'ITW must never receive the DFK keyword.');
  assert.deepEqual(await redis.lRange(`${prefix}job_history:ITW`, 0, -1), ['legacy leaked DFK keyword'], 'Legacy lists remain untouched and must not be served.');
  const cached = await request('DFK-B', '/search?q=cloud%20support');
  assert.equal(cached.cached, true);
  assert.deepEqual((await request('DFK-A', '/history')).keywords, ['cloud support']);
  assert.equal((await request('ITW-C', '/history/DFK')).status, 403);
  assert.equal((await request('ITW-C', '/history?department=DFK')).status, 403);
  assert.equal((await request('ITW-C', '/history?studentId=DFK-A')).status, 403);
  assert.equal((await request('ITW-C', '/search?q=forged&department=DFK')).status, 403);
  assert.equal((await request('ITW-C', '/search?q=forged&studentId=DFK-A')).status, 403);
  await request('ITW-C', '/search?q=welding');
  assert.deepEqual((await request('DFK-A', '/history')).keywords, ['cloud support']);
  assert.deepEqual((await request('ITW-C', '/history')).keywords, ['welding']);
  const pathway = await request('DFK-A', '/pathways/DFK-A');
  assert.equal(pathway.department, 'DFK');
  assert.equal(pathway.pathway.courseCode, 'DFK');
  await Student.updateOne({ ID_Pelajar: 'DFK-A', sourceDataset: 'current' }, { $set: { Kursus: 'ITW' } });
  assert.deepEqual((await request('DFK-A', '/history')).keywords, ['welding']);
  assert.equal((await request('DFK-A', '/history/DFK')).status, 403);
  await request('DFK-A', '/search?q=wireman');
  assert.deepEqual((await request('ITW-C', '/history')).keywords, ['wireman', 'welding']);
  assert.deepEqual((await request('DFK-B', '/history')).keywords, ['cloud support']);
  console.log('PASS: two DFK students share history; ITW stays isolated; forged course and student selectors are rejected.');
  console.log('PASS: cache hits preserve course isolation; legacy leaked keywords are ignored; a course change revokes previous-course access.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (redis.isOpen) {
    for await (const keys of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      if (keys.length) await redis.del(keys);
    }
    await redis.quit();
  }
  if (mongoose.connection.readyState) {
    assert.equal(mongoose.connection.name, database);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
