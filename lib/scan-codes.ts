/** Codice breve stampato sotto il QR: sostituisce il link nel biglietto. */

export const SCAN_CODE_LENGTH = 8

/** Senza caratteri che si confondono a occhio (0/O, 1/I). */
export const SCAN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** `K7M2P9QX` → `K7M2-P9QX`, come si legge sul biglietto. */
export function formatScanCode(code: string) {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '')
  return `${clean.slice(0, 4)}-${clean.slice(4)}`
}

export function normalizeScanCode(value: string) {
  const clean = value.toUpperCase().replace(/[^0-9A-Z]/g, '')
  return clean.length === SCAN_CODE_LENGTH ? clean : null
}

export type ScanTarget = { code: string } | { participantId: string }

/**
 * Accetta quello che arriva dalla fotocamera: il codice del biglietto,
 * un vecchio QR con il link `/tutor/scan/<id>` o l'id incollato a mano.
 */
export function parseScanInput(value: string): ScanTarget | null {
  const text = value.trim()
  const urlMatch = text.match(/\/tutor\/scan\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i)
  if (urlMatch) return { participantId: urlMatch[1] }
  if (UUID_PATTERN.test(text)) return { participantId: text }

  const code = normalizeScanCode(text)
  return code ? { code } : null
}
