import { describe, expect, it } from 'vitest';
import { isReservedNickname, normalizeNickname } from '../../src/domain/identity';

describe('nickname normalization', () => {
  it('normalizes unicode to NFC before storing and comparing', () => {
    expect(normalizeNickname('e\u0301')).toBe('é');
  });

  it('blocks reserved account and service names case-insensitively', () => {
    for (const nickname of ['ADMIN', 'Administrator', 'Apoen', 'support']) expect(isReservedNickname(nickname)).toBe(true);
    expect(isReservedNickname('Dejan_42')).toBe(false);
  });
});
