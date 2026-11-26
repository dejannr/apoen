export const gameModeLabels: Record<string, string> = {
  EDGE: 'Na ivici',
  CONFIDENCE: 'Koliko si siguran?',
  ORDER: 'Ne prekidaj niz',
  HIGH_LOW: 'Veće ili manje',
};

export const attemptReasonLabels: Record<string, string> = {
  SUBMITTED: 'Odgovor je potvrđen.',
  WRONG: 'Odgovor nije tačan.',
  CASHED_OUT: 'Preuzeo/la si osvojeni iznos.',
  MAX_STEPS: 'Uspešno si završio/la sve korake.',
  TIMEOUT: 'Vreme za odgovor je isteklo.',
  ABANDONED: 'Izazov je prekinut.',
};

export function gameModeLabel(mode: string) {
  return gameModeLabels[mode] ?? mode;
}

export function attemptReasonLabel(reason?: string | null) {
  return reason ? attemptReasonLabels[reason] ?? reason : '';
}
