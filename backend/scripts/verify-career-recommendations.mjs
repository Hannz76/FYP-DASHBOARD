import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';
import { createClient } from 'redis';

assert.ok(process.env.HISTORY_TEST_MONGO_URI, 'Set HISTORY_TEST_MONGO_URI to a test MongoDB server.');
assert.ok(process.env.HISTORY_TEST_REDIS_URL, 'Set HISTORY_TEST_REDIS_URL to a disposable Redis server.');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'career-recommendation-verification-secret';
const database = `career_recommendation_test_${randomUUID().replaceAll('-', '')}`;
const prefix = `${database}:`;
const { default: app } = await import('../server.js');
const { default: Student } = await import('../models/Student.js');
const { default: MdbFile } = await import('../models/MdbFile.js');
const { default: User } = await import('../models/User.js');
const { signTokenForUser } = await import('../auth.model.js');
const { careerCache, createCareerCache } = await import('../services/careerCache.service.js');
const { buildSearchCacheKey, parseSearchParameters } = await import('../utils/careerCache.js');
const redis = createClient({ url: process.env.HISTORY_TEST_REDIS_URL });
redis.on('error', () => {});
const connectionFor = (scope) => ({
  time: () => redis.time(),
  eval: (script, options) => redis.eval(script, { ...options, keys: options.keys.map(key => scope + key) }),
});
const ids = (entries) => entries.map(({ job }) => job.jobId);
const allIds = (result) => [...ids(result.suggestions), ...ids(result.needsReview), ...ids(result.olderAdvertisements)];
let server;

try {
  await mongoose.connect(process.env.HISTORY_TEST_MONGO_URI, { dbName: database });
  await redis.connect();
  const now = Date.now();
  const job = (jobId, title, location, days = 0) => ({
    jobId, title, company: 'Fixture employer', location,
    applyLink: `https://example.test/jobs/${jobId}`,
    salary: 'Gaji / elaun tidak dinyatakan',
    postedAt: days === null ? '' : new Date(now - days * 86400000).toISOString(),
    source: 'Fixture jobs',
  });
  const jobs = [
    job('A', 'Cloud Support Intern', 'Selangor', 4),
    job('B', 'Cloud Support Intern', 'Penang', 1),
    job('C', 'IT Support Intern', 'Selangor'),
    job('D', 'Technology Programme', 'Lokasi tidak dinyatakan', null),
    job('E', 'Cloud Support Intern', 'Selangor', 60),
    job('G', 'Pipe Welder Intern', 'Selangor'),
  ];
  let providerCalls = 0;
  Object.assign(careerCache, createCareerCache({
    client: async () => connectionFor(prefix),
    search: async (params) => {
      providerCalls += 1;
      if (params.query.includes('welding')) return { jobs: [job('W', 'Welder Intern', 'Terengganu')], cursor: null };
      if (params.query.includes('extra')) return {
        jobs: [jobs[0], { ...jobs[0], jobId: 'A-alternate', applyLink: `${jobs[0].applyLink}?utm_source=mirror` }], cursor: null,
      };
      return { jobs, cursor: null };
    },
  }));
  await MdbFile.create([
    { datasetName: 'previous', originalName: 'previous.mdb', filePath: '/test/previous.mdb', fileSize: 1, status: 'Processed', processedDate: new Date('2025-01-01') },
    { datasetName: 'current', originalName: 'current.mdb', filePath: '/test/current.mdb', fileSize: 1, status: 'Processed', processedDate: new Date(), isCurrentSemester: true },
  ]);
  await Student.create([
    { ID_Pelajar: 'DFK-A', Kursus: 'ITW', sourceDataset: 'previous' },
    { ID_Pelajar: 'DFK-A', Kursus: 'DFK', sourceDataset: 'current', CGPA: '2.0' },
    { ID_Pelajar: 'DFK-B', Kursus: ' *dfk* ', sourceDataset: 'current', CGPA: '4.0' },
    { ID_Pelajar: 'ITW-C', Kursus: 'ITW', sourceDataset: 'current' },
    { ID_Pelajar: 'OLD-ONLY', Kursus: 'DFK', sourceDataset: 'previous' },
  ]);
  const tokens = {};
  for (const studentId of ['DFK-A', 'DFK-B', 'ITW-C', 'OLD-ONLY']) {
    const user = await User.create({ email: `${studentId.toLowerCase()}@example.test`, password: 'unused-fixture-hash', role: 'user', studentId });
    tokens[studentId] = signTokenForUser(user);
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/careers`;
  async function request(studentId, path) {
    const response = await fetch(base + path, { headers: { Authorization: `Bearer ${tokens[studentId]}` } });
    const body = await response.json();
    return { ...body, status: response.status };
  }
  const cloudChoices = '/recommendations?roleFamilyId=cloud-support&placeId=selangor&placeMode=prefer';
  const supportChoices = '/recommendations?roleFamilyId=it-support&placeId=selangor&placeMode=require';
  const legacyKey = `${prefix}job_cache:DFK:legacy`;
  await redis.set(legacyKey, JSON.stringify({ resetAt: now + 60000, value: { jobs: [job('LEGACY', 'Cloud Support Intern', 'Selangor')], cursor: null } }));
  const empty = await request('DFK-A', '/recommendations');
  assert.equal(empty.status, 200);
  assert.equal(empty.emptyReason, 'no-history');
  assert.deepEqual(allIds(empty), [], 'Legacy pages must not populate the trusted candidate pool.');
  assert.equal(providerCalls, 0, 'Opening an empty recommendation list must not call a provider.');

  const searched = await request('DFK-A', '/search?q=cloud%20support');
  assert.equal(searched.status, 200);
  assert.equal(searched.department, 'DFK', 'The current course must override an older ITW snapshot.');
  assert.equal(providerCalls, 1);
  const { params } = parseSearchParameters({ q: 'cloud support' });
  const pageKey = prefix + buildSearchCacheKey('DFK', params);
  const originalPage = JSON.parse(await redis.get(pageKey));
  assert.equal(originalPage.schemaVersion, 3);
  assert.equal(originalPage.department, 'DFK');
  assert.deepEqual(originalPage.params, params);
  assert.ok(originalPage.fetchedAt > 0);
  const cached = await request('DFK-B', '/search?q=cloud%20support');
  assert.equal(cached.status, 200);
  assert.equal(cached.cached, true);
  assert.deepEqual(cached.jobs, searched.jobs);
  assert.equal(providerCalls, 1, 'A second DFK student must reuse the saved provider page.');
  assert.deepEqual(JSON.parse(await redis.get(pageKey)), originalPage, 'A cache hit must change neither fetchedAt nor resetAt.');

  const forA = await request('DFK-A', cloudChoices);
  const forB = await request('DFK-B', supportChoices);
  assert.equal(forA.status, 200);
  assert.equal(forB.status, 200);
  assert.deepEqual(ids(forA.suggestions), ['A', 'B', 'C']);
  assert.deepEqual(ids(forB.suggestions), ['C', 'A']);
  assert.deepEqual(ids(forA.needsReview), ['D']);
  assert.deepEqual(ids(forB.needsReview), ['D']);
  assert.deepEqual(ids(forA.olderAdvertisements), ['E']);
  assert.ok(!allIds(forA).includes('G'), 'A DFK search does not turn a welding role into a DFK recommendation.');
  assert.equal(providerCalls, 1, 'Reading and reranking saved results must not call a provider.');
  await Student.updateOne({ ID_Pelajar: 'DFK-A', sourceDataset: 'current' }, { $set: { CGPA: '4.0', PLO_1: '100' } });
  assert.deepEqual(ids((await request('DFK-A', cloudChoices)).suggestions), ['A', 'B', 'C'], 'Academic scalars cannot alter job ranking without employer requirements.');

  const itwEmpty = await request('ITW-C', '/recommendations');
  assert.equal(itwEmpty.status, 200);
  assert.deepEqual(allIds(itwEmpty), [], 'ITW must receive none of the DFK results.');
  for (const query of ['department=DFK', 'studentId=DFK-A', 'dataset=previous', 'score=100']) {
    const forged = await request('ITW-C', `/recommendations?${query}`);
    assert.ok([400, 403].includes(forged.status), `Recommendation scope forgery must fail: ${query}`);
  }
  assert.equal((await request('ITW-C', '/search?q=forged&department=DFK')).status, 403);
  assert.equal((await request('ITW-C', '/history/DFK')).status, 403);
  for (const path of ['/search?q=cloud', '/history', '/recommendations']) {
    const missing = await request('OLD-ONLY', path);
    assert.equal(missing.status, 403);
    assert.equal(missing.code, 'MEMBERSHIP_UNAVAILABLE', 'An old-only record must never authorize shared career access.');
  }
  assert.equal((await request('DFK-B', '/search?q=extra')).status, 200);
  const duplicateResult = await request('DFK-A', cloudChoices);
  assert.equal(duplicateResult.suggestions.filter(({ job: listing }) => listing.title === 'Cloud Support Intern' && listing.location === 'Selangor').length, 1, 'Repeated provider IDs and matching application snapshots must collapse.');
  assert.equal((await request('ITW-C', '/search?q=welding')).status, 200);
  assert.deepEqual(ids((await request('ITW-C', '/recommendations')).suggestions), ['W']);
  await Student.updateOne({ ID_Pelajar: 'DFK-A', sourceDataset: 'current' }, { $set: { Kursus: 'ITW' } });
  assert.deepEqual(ids((await request('DFK-A', '/recommendations')).suggestions), ['W']);
  assert.equal((await request('DFK-A', '/history/DFK')).status, 403);
  assert.equal((await request('DFK-A', '/search?q=cloud&department=DFK')).status, 403);
  assert.ok(!(await request('DFK-B', supportChoices)).suggestions.some(({ job: listing }) => listing.jobId === 'W'));
  assert.ok(await redis.exists(legacyKey), 'Verification must ignore rather than delete legacy keys.');
  console.log('PASS: DFK students reuse one provider page and receive personal orders A/B/C and C/A; ITW remains isolated.');
  console.log('PASS: forged scope, stale membership and unrelated roles are rejected; unknown requirements, older ads and duplicate jobs are handled.');

  const capacityPrefix = `${prefix}capacity:`;
  const bounded = createCareerCache({ client: async () => connectionFor(capacityPrefix), search: async () => ({ jobs: [], cursor: null }) });
  for (let i = 0; i < 31; i += 1) {
    await bounded.search('DFK', parseSearchParameters({ q: `capacity ${i}` }).params);
    await delay(1);
  }
  const indexKey = `${capacityPrefix}job_pages:v3:DFK`;
  assert.equal(await redis.zCard(indexKey), 30, 'The course index must retain at most thirty pages.');
  const indexBeforeHit = await redis.zRangeWithScores(indexKey, 0, -1);
  await bounded.search('DFK', parseSearchParameters({ q: 'capacity 1' }).params);
  assert.deepEqual(await redis.zRangeWithScores(indexKey, 0, -1), indexBeforeHit, 'Cache hits must not promote indexed pages.');
  assert.equal((await bounded.candidates('DFK')).pages.length, 30);

  const expiryPrefix = `${prefix}expiry:`;
  const [seconds, microseconds] = await redis.time();
  const deadline = Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000) + 300;
  const expiring = createCareerCache({
    client: async () => connectionFor(expiryPrefix),
    search: async () => ({ jobs: [jobs[0]], cursor: null }),
    windowFor: (timestamp) => ({ expiresAt: timestamp < deadline ? deadline : deadline + 60000 }),
  });
  await expiring.search('DFK', params, 'cloud support');
  assert.equal((await expiring.candidates('DFK')).pages.length, 1);
  await delay(Math.max(0, deadline - Date.now() + 10));
  assert.deepEqual((await expiring.candidates('DFK')).pages, []);
  assert.equal(await redis.exists(`${expiryPrefix}job_pages:v3:DFK`), 0);
  assert.deepEqual((await expiring.history('DFK')).keywords, []);
  console.log('PASS: the real Redis index is bounded and hits preserve freshness; expiry removes pages, candidate index and keyword history.');
} catch (error) {
  console.error(`FAIL: ${error.stack || error.message}`);
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
