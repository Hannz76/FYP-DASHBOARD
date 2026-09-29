import { describe, it, expect } from 'vitest';
import { getRoleLabel, isStaff } from '@/lib/roles';

describe('roles lib', () => {
  it('labels counselor as Penyelaras like admin', () => {
    expect(getRoleLabel('counselor')).toBe('Penyelaras');
    expect(getRoleLabel('admin')).toBe('Penyelaras');
  });

  it('labels students as Pelajar', () => {
    expect(getRoleLabel('user')).toBe('Pelajar');
  });

  it('passes unknown roles through', () => {
    expect(getRoleLabel('ghost')).toBe('ghost');
  });

  it('groups staff correctly', () => {
    expect(isStaff('counselor')).toBe(true);
    expect(isStaff('admin')).toBe(true);
    expect(isStaff('user')).toBe(false);
  });
});
