const reservedNicknames = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'support', 'staff',
  'system', 'root', 'owner', 'help', 'null', 'undefined', 'apoen',
]);

export function normalizeNickname(value: string) {
  return value.normalize('NFC');
}

export function isReservedNickname(value: string) {
  return reservedNicknames.has(normalizeNickname(value).toLocaleLowerCase('sr-Latn-RS'));
}
