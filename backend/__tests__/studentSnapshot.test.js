import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import Student from '../models/Student.js';
import MdbFile from '../models/MdbFile.js';
import { getStudentById, getStudentRecordById, getCurrentCareerSubject } from '../item.model.js';

const previous = { ID_Pelajar: 'DFK-A', Kursus: 'ITW', sourceDataset: 'previous', CGPA: '2.75' };
const current = { ID_Pelajar: 'DFK-A', Kursus: 'DFK', sourceDataset: 'current', CGPA: '3.25' };

beforeEach(() => {
  jest.spyOn(MdbFile, 'findOne').mockResolvedValue({ datasetName: 'current' });
  jest.spyOn(Student, 'findOne').mockImplementation(({ sourceDataset }) => {
    const record = sourceDataset === 'current' ? current : sourceDataset === 'previous' ? previous : null;
    return Object.assign(Promise.resolve(record), { sort: async () => current });
  });
});

afterEach(() => jest.restoreAllMocks());

it('uses the current DFK snapshot for both raw membership and normalized academic reads', async () => {
  const membership = await getStudentRecordById('DFK-A');
  const academic = await getStudentById('DFK-A');
  expect(membership).toEqual(current);
  expect(academic).toMatchObject({ id: 'DFK-A', kursus: 'DFK', cgpa: 3.25, sourceDataset: 'current' });
  expect(await getCurrentCareerSubject('DFK-A')).toEqual({ department: 'DFK', dataset: 'current', student: current });
});

it('keeps an explicitly pinned historical snapshot and does not fall back for a missing dataset', async () => {
  expect(await getStudentRecordById('DFK-A', 'previous')).toEqual(previous);
  expect(await getStudentRecordById('DFK-A', 'missing')).toBeNull();
});

it('uses the newest own snapshot when the current dataset does not contain the student', async () => {
  Student.findOne.mockImplementation(({ sourceDataset }) =>
    Object.assign(Promise.resolve(sourceDataset ? null : previous), { sort: async () => current })
  );
  expect(await getStudentRecordById('DFK-A')).toEqual(current);
  await expect(getCurrentCareerSubject('DFK-A')).rejects.toMatchObject({ code: 'MEMBERSHIP_UNAVAILABLE', status: 403 });
});

it('returns no student when there is no processed dataset', async () => {
  MdbFile.findOne.mockImplementation(() =>
    Object.assign(Promise.resolve(null), { sort: async () => null })
  );
  expect(await getStudentRecordById('DFK-A')).toBeNull();
  expect(await getStudentById('DFK-A')).toBeNull();
  await expect(getCurrentCareerSubject('DFK-A')).rejects.toMatchObject({ code: 'MEMBERSHIP_UNAVAILABLE', status: 403 });
});

it('normalizes the current course and rejects unsupported course records', async () => {
  Student.findOne.mockResolvedValue({ ...current, Kursus: ' *dfk* ' });
  expect((await getCurrentCareerSubject('DFK-A')).department).toBe('DFK');
  Student.findOne.mockResolvedValue({ ...current, Kursus: 'unknown' });
  await expect(getCurrentCareerSubject('DFK-A')).rejects.toMatchObject({ code: 'INVALID_DEPARTMENT', status: 403 });
});
