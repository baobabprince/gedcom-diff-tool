/** Shared localStorage between baobabprince GitHub Pages apps */

export const SHARED_KEY = 'baobab:shared:export:v1';
export const SHARED_VERSION = 1;

export type BaobabSharedExport = {
  version: number;
  source: string;
  exportedAt: string;
  filename: string;
  encoding: string;
  gedcom: string;
  meta?: { personCount?: number; familyCount?: number; title?: string };
};

export function saveSharedExport(opts: {
  source: string;
  filename?: string;
  gedcom: string;
  encoding?: string;
  meta?: BaobabSharedExport['meta'];
}): BaobabSharedExport {
  if (!opts?.gedcom?.trim()) throw new Error('gedcom text is required');
  const payload: BaobabSharedExport = {
    version: SHARED_VERSION,
    source: opts.source || 'unknown',
    exportedAt: new Date().toISOString(),
    filename: opts.filename || 'family.ged',
    encoding: opts.encoding || 'utf-8',
    gedcom: opts.gedcom,
    meta: opts.meta || {},
  };
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('baobab shared save failed:', err);
    throw err;
  }
  return payload;
}

export function loadSharedExport(): BaobabSharedExport | null {
  try {
    const raw = localStorage.getItem(SHARED_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as BaobabSharedExport;
    if (!data || data.version !== SHARED_VERSION || typeof data.gedcom !== 'string') return null;
    return data;
  } catch (err) {
    console.error('baobab shared load failed:', err);
    return null;
  }
}

export function hasSharedExport(): boolean {
  return !!loadSharedExport();
}

export function formatSharedSummary(data: BaobabSharedExport | null): string {
  if (!data) return '';
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString('he-IL') : '';
  const people =
    data.meta && data.meta.personCount != null ? `${data.meta.personCount} אנשים` : '';
  return [data.filename, data.source, when, people].filter(Boolean).join(' · ');
}
