#!/usr/bin/env python3
from pathlib import Path

def main():
    p = Path('src/App.tsx')
    t = p.read_text()

    if 'baobabSharedStorage' not in t:
        needle = "from './lib/gedcom';"
        if needle not in t:
            raise SystemExit('gedcom import not found')
        t = t.replace(
            needle,
            needle + "\nimport { saveSharedExport, loadSharedExport, hasSharedExport, formatSharedSummary } from './lib/baobabSharedStorage';",
            1,
        )

    # enhance handleFile to also keep raw text and auto-save
    if 'handleLoadShared' not in t:
        old = '''  const handleFile = async (file: File | undefined, side: 'A' | 'B') => {
    if (!file) return;

    try {
      const text = await file.text();
      const records = parseGedcom(text);
      if (records.length === 0) {
        throw new Error('No records found');
      }
      if (side === 'A') setFileA({ name: file.name, records });
      else setFileB({ name: file.name, records });
    } catch (err) {
      console.error(err);
      alert(t.parseError);
    }
  };'''
        new = '''  const handleFile = async (file: File | undefined, side: 'A' | 'B') => {
    if (!file) return;

    try {
      const text = await file.text();
      const records = parseGedcom(text);
      if (records.length === 0) {
        throw new Error('No records found');
      }
      if (side === 'A') setFileA({ name: file.name, records, raw: text });
      else setFileB({ name: file.name, records, raw: text });
      try {
        saveSharedExport({
          source: 'gedcom-diff',
          filename: file.name,
          gedcom: text,
          meta: { personCount: records.filter((r: any) => r.tag === 'INDI').length, title: file.name },
        });
      } catch (_) {}
    } catch (err) {
      console.error(err);
      alert(t.parseError);
    }
  };

  const handleLoadShared = (side: 'A' | 'B' = 'A') => {
    const shared = loadSharedExport();
    if (!shared?.gedcom) {
      alert(lang === 'he' ? 'אין נתונים משותפים לטעינה.' : 'No shared data.');
      return;
    }
    try {
      const records = parseGedcom(shared.gedcom);
      if (records.length === 0) throw new Error('empty');
      const payload = { name: shared.filename || 'shared.ged', records, raw: shared.gedcom };
      if (side === 'A') setFileA(payload);
      else setFileB(payload);
    } catch (err) {
      console.error(err);
      alert(t.parseError);
    }
  };

  const handleSaveShared = (side: 'A' | 'B' = 'A') => {
    const f = side === 'A' ? fileA : fileB;
    if (!f || !(f as any).raw) {
      alert(lang === 'he' ? 'יש לטעון קובץ תחילה.' : 'Load a file first.');
      return;
    }
    try {
      saveSharedExport({
        source: 'gedcom-diff',
        filename: f.name,
        gedcom: (f as any).raw,
        meta: { personCount: f.records.filter((r: any) => r.tag === 'INDI').length },
      });
    } catch (_) {
      alert(lang === 'he' ? 'שמירה נכשלה.' : 'Save failed.');
    }
  };'''
        if old not in t:
            raise SystemExit('handleFile block not found')
        t = t.replace(old, new, 1)

    # UI near upload grid - after the two UploadCards section
    if 'טען מהשיתוף' not in t:
        anchor = '''            <div className="grid md:grid-cols-2 gap-8">
              <UploadCard'''
        # add shared bar after the grid closes - find unique hero start
        marker = 'bg-[#fefefb] text-[#29392f] p-10 rounded-2xl'
        if marker in t:
            shared_bar = '''            <div className="mt-6 p-4 rounded-2xl border border-[#e7e8e0] bg-[#fefefb]">
              <p className="text-xs font-semibold text-[#456352] mb-1">שיתוף בין אפליקציות (localStorage)</p>
              <p className="text-[11px] text-[#82877e] mb-3 truncate">{formatSharedSummary(loadSharedExport()) || 'אין נתונים משותפים עדיין'}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleLoadShared('A')} className="text-xs px-3 py-2 rounded-xl bg-[#edf1e9] text-[#456352] font-medium">טען מהשיתוף → A</button>
                <button type="button" onClick={() => handleLoadShared('B')} className="text-xs px-3 py-2 rounded-xl bg-[#edf1e9] text-[#456352] font-medium">טען מהשיתוף → B</button>
                <button type="button" onClick={() => handleSaveShared('A')} className="text-xs px-3 py-2 rounded-xl bg-[#ac694c] text-white font-medium">שמור A לשיתוף</button>
                <button type="button" onClick={() => handleSaveShared('B')} className="text-xs px-3 py-2 rounded-xl bg-[#ac694c] text-white font-medium">שמור B לשיתוף</button>
              </div>
            </div>

            <div className="''' + marker
            t = t.replace('<div className="' + marker, shared_bar, 1)

    # type state may need raw optional - use any cast already

    p.write_text(t)
    print('App.tsx', p.stat().st_size)
    print('import', 'baobabSharedStorage' in t)
    print('handlers', 'handleLoadShared' in t)
    print('ui', 'טען מהשיתוף' in t)

if __name__ == '__main__':
    main()
