import { describe, expect, it } from 'vitest';
import { attemptReasonLabel, gameModeLabel } from '../../src/domain/game-copy';

describe('game copy', () => {
  it('maps internal format codes to Serbian names', () => {
    expect(['EDGE', 'CONFIDENCE', 'ORDER', 'HIGH_LOW'].map(gameModeLabel)).toEqual([
      'Na ivici', 'Koliko si siguran?', 'Ne prekidaj niz', 'Veće ili manje',
    ]);
  });

  it('maps internal result codes to Serbian messages', () => {
    expect(attemptReasonLabel('CASHED_OUT')).toBe('Preuzeo/la si osvojeni iznos.');
    expect(attemptReasonLabel('TIMEOUT')).toBe('Vreme za odgovor je isteklo.');
  });
});
