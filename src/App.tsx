/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, ChangeEvent, ReactNode } from 'react';
import { 
  FileUp, 
  ArrowRight, 
  Plus, 
  Minus, 
  RefreshCcw, 
  Search, 
  Info,
  User,
  Users,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Languages,
  Code2,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import _ from 'lodash';
import { diff_match_patch as DiffMatchPatch } from 'diff-match-patch';
import { parseGedcom, compareGedcoms, GedcomRecord, DiffResult } from './lib/gedcom';

type Tab = 'all' | 'added' | 'removed' | 'modified';
type Lang = 'he' | 'en';

const translations = {
  he: {
    title: 'GEDCOM Nexus',
    subtitle: 'מנוע השוואה גנאלוגי',
    restart: 'התחל מחדש',
    uploadA: 'גרסה ישנה (A)',
    uploadB: 'גרסה חדשה (B)',
    chooseFile: 'בחר קובץ GEDCOM',
    uploadBtn: 'העלה קובץ',
    heroTitle: 'השוו את עצי המשפחה שלכם',
    heroDesc: 'העלו שני קבצי GEDCOM כדי לראות בדיוק מה השתנה: אנשים שנוספו, הוסרו או פרטים שעודכנו.',
    totalChanges: 'סה"כ שינויים',
    added: 'נוספו',
    removed: 'הוסרו',
    modified: 'עודכנו',
    all: 'הכל',
    searchPlaceholder: 'חיפוש לפי שם או מזהה...',
    noResults: 'לא נמצאו שינויים התואמים את החיפוש',
    indi: 'פרט',
    fam: 'משפחה',
    addedLabel: 'נוסף',
    removedLabel: 'הוסר',
    modifiedLabel: 'עודכן',
    originVer: 'גרסת מקור',
    newVer: 'גרסה חדשה',
    recordData: 'נתוני הרשומה',
    parseError: 'שגיאה בפענוח קובץ GEDCOM. אנא וודא שהקובץ תקין.',
    more: 'נוספים',
    records: 'רשומות',
    viewSmart: 'תצוגה חכמה',
    viewDiff: 'צד מול צד',
    viewRaw: 'נתונים גולמיים',
    original: 'מקור',
    updated: 'מעודכן'
  },
  en: {
    title: 'GEDCOM Nexus',
    subtitle: 'Genealogical Comparison Engine',
    restart: 'Restart',
    uploadA: 'Old Version (A)',
    uploadB: 'New Version (B)',
    chooseFile: 'Choose GEDCOM File',
    uploadBtn: 'Upload File',
    heroTitle: 'Compare Your Family Trees',
    heroDesc: 'Upload two GEDCOM files to see exactly what changed: added or removed individuals, or updated details.',
    totalChanges: 'Total Changes',
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
    all: 'All',
    searchPlaceholder: 'Search by name or ID...',
    noResults: 'No changes found matching your search',
    indi: 'Individual',
    fam: 'Family',
    addedLabel: 'Added',
    removedLabel: 'Removed',
    modifiedLabel: 'Modified',
    originVer: 'Original Version',
    newVer: 'New Version',
    recordData: 'Record Data',
    parseError: 'Error parsing GEDCOM file. Please ensure the file is valid.',
    more: 'more',
    records: 'Records',
    viewSmart: 'Smart View',
    viewDiff: 'Side by Side',
    viewRaw: 'Raw Data',
    original: 'Original',
    updated: 'Updated'
  }
};

export default function App() {
  const [lang, setLang] = useState<Lang>('he');
  const [fileA, setFileA] = useState<{ name: string; records: GedcomRecord[] } | null>(null);
  const [fileB, setFileB] = useState<{ name: string; records: GedcomRecord[] } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const t = translations[lang];

  const fileAMap = useMemo(() => _.keyBy(fileA?.records || [], 'id'), [fileA]);
  const fileBMap = useMemo(() => _.keyBy(fileB?.records || [], 'id'), [fileB]);

  const diff = useMemo(() => {
    if (!fileA || !fileB) return null;
    return compareGedcoms(fileA.records, fileB.records);
  }, [fileA, fileB]);

  const fileStats = useMemo(() => {
    if (!fileA || !fileB) return null;
    const getStats = (recs: GedcomRecord[]) => ({
      inds: recs.filter(r => r.tag === 'INDI').length,
      fams: recs.filter(r => r.tag === 'FAM').length,
      total: recs.length
    });
    return {
      a: getStats(fileA.records),
      b: getStats(fileB.records)
    };
  }, [fileA, fileB]);

  const stats = useMemo(() => {
    if (!diff) return null;
    return {
      added: diff.added.length,
      removed: diff.removed.length,
      modified: diff.modified.length,
      total: diff.added.length + diff.removed.length + diff.modified.length
    };
  }, [diff]);

  const getDisplayName = (record: any) => {
    const data = record.type === 'modified' ? record.newData : record.data;
    const map = record.type === 'removed' ? fileAMap : fileBMap;
    
    if (!data) return record.id;
    
    if (record.tag === 'INDI') {
      const name = data.NAME?.value || data.NAME?.[0]?.value || 'Unknown Individual';
      return name.replace(/\//g, '').trim();
    }
    if (record.tag === 'FAM') {
      const husbId = data.HUSB?.value || data.HUSB;
      const wifeId = data.WIFE?.value || data.WIFE;
      
      const husbName = husbId ? getDisplayNameFromId(husbId, map) : '';
      const wifeName = wifeId ? getDisplayNameFromId(wifeId, map) : '';
      
      if (husbName && wifeName) return `${husbName} & ${wifeName}`;
      if (husbName) return `${husbName} + Unknown`;
      if (wifeName) return `Unknown + ${wifeName}`;
      
      return `${t.fam} ${record.id}`;
    }
    return `${record.tag} ${record.id}`;
  };

  function getDisplayNameFromId(id: string, map: Record<string, GedcomRecord>): string {
    const record = map[id];
    if (!record || record.tag !== 'INDI') return id;
    const data = record.data;
    const name = data.NAME?.value || data.NAME?.[0]?.value || 'Unknown Individual';
    return name.replace(/\//g, '').trim();
  }

  const filteredItems = useMemo(() => {
    if (!diff) return [];
    
    let items: any[] = [];
    if (activeTab === 'all' || activeTab === 'added') {
      items.push(...diff.added.map(r => ({ ...r, type: 'added' as const })));
    }
    if (activeTab === 'all' || activeTab === 'removed') {
      items.push(...diff.removed.map(r => ({ ...r, type: 'removed' as const })));
    }
    if (activeTab === 'all' || activeTab === 'modified') {
      items.push(...diff.modified.map(r => ({ ...r, type: 'modified' as const })));
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(item => {
        const name = getDisplayName(item).toLowerCase();
        return name.includes(q) || item.id.toLowerCase().includes(q);
      });
    }

    return items;
  }, [diff, activeTab, search, lang]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, side: 'A' | 'B') => {
    const file = e.target.files?.[0];
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
  };

  return (
    <div 
      className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]" 
      dir={lang === 'he' ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className="border-b border-[#141414]/10 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141414] rounded-lg flex items-center justify-center text-white">
              <RefreshCcw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-serif italic text-xl leading-tight">{t.title}</h1>
              <p className="text-[10px] uppercase tracking-wider opacity-50 font-mono"> {t.subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
              className="p-2 hover:bg-[#141414]/5 rounded-lg transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-widest"
            >
              <Languages className="w-4 h-4" />
              {lang === 'he' ? 'English' : 'עברית'}
            </button>
            <button 
              onClick={() => { setFileA(null); setFileB(null); }}
              className="text-xs uppercase tracking-widest font-mono opacity-50 hover:opacity-100 transition-opacity"
            >
              {t.restart}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!fileA || !fileB ? (
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <UploadCard 
              id="file-a" 
              label={t.uploadA} 
              fileName={fileA?.name} 
              onUpload={(e) => handleFileChange(e, 'A')}
              t={t}
            />
            <UploadCard 
              id="file-b" 
              label={t.uploadB} 
              fileName={fileB?.name} 
              onUpload={(e) => handleFileChange(e, 'B')}
              t={t}
            />
            
            <div className="md:col-span-2 bg-[#141414] text-white p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
              <div className="relative z-10">
                <h2 className="text-3xl font-serif italic mb-2">{t.heroTitle}</h2>
                <p className="opacity-70 max-w-md">{t.heroDesc}</p>
              </div>
              <div className="flex -space-x-4 ltr:space-x-0 rtl:space-x-reverse relative z-10">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-12 h-12 rounded-full border-4 border-[#141414] bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <User className="w-6 h-6 opacity-50" />
                  </div>
                ))}
              </div>
              {/* Decorative background element */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Comparative Stats */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white overflow-hidden rounded-2xl border border-[#141414]/5 shadow-sm">
                <div className="bg-[#141414]/5 px-4 py-2 border-b border-[#141414]/5 flex justify-between items-center">
                  <span className="text-[10px] uppercase font-mono tracking-widest opacity-50">File A: {fileA.name}</span>
                  <FileText className="w-3 h-3 opacity-30" />
                </div>
                <div className="p-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-serif">{fileStats?.a.inds}</p>
                    <p className="text-[9px] uppercase font-mono opacity-40">{t.indi}</p>
                  </div>
                  <div>
                    <p className="text-xl font-serif">{fileStats?.a.fams}</p>
                    <p className="text-[9px] uppercase font-mono opacity-40">{t.fam}</p>
                  </div>
                  <div className="border-r border-[#141414]/5 ltr:border-r-0 ltr:border-l rtl:border-r">
                    <p className="text-xl font-serif">{fileStats?.a.total}</p>
                    <p className="text-[9px] uppercase font-mono opacity-40">{t.records}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white overflow-hidden rounded-2xl border border-[#141414]/5 shadow-sm">
                <div className="bg-[#141414]/5 px-4 py-2 border-b border-[#141414]/5 flex justify-between items-center">
                  <span className="text-[10px] uppercase font-mono tracking-widest opacity-50">{lang === 'he' ? 'קובץ' : 'File'} B: {fileB.name}</span>
                  <FileText className="w-3 h-3 opacity-30" />
                </div>
                <div className="p-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-serif">{fileStats?.b.inds}</p>
                    <p className="text-[9px] uppercase font-mono opacity-40">{t.indi}</p>
                  </div>
                  <div>
                    <p className="text-xl font-serif">{fileStats?.b.fams}</p>
                    <p className="text-[9px] uppercase font-mono opacity-40">{t.fam}</p>
                  </div>
                  <div className="border-r border-[#141414]/5 ltr:border-r-0 ltr:border-l rtl:border-r">
                    <p className="text-xl font-serif">{fileStats?.b.total}</p>
                    <p className="text-[9px] uppercase font-mono opacity-40">{t.records}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Diff Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label={t.totalChanges} value={stats?.total || 0} icon={<RefreshCcw className="w-5 h-5" />} color="bg-blue-500" />
              <StatCard label={t.added} value={stats?.added || 0} icon={<Plus className="w-5 h-5" />} color="bg-green-500" />
              <StatCard label={t.removed} value={stats?.removed || 0} icon={<Minus className="w-5 h-5" />} color="bg-red-500" />
              <StatCard label={t.modified} value={stats?.modified || 0} icon={<AlertCircle className="w-5 h-5" />} color="bg-amber-500" />
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-2 rounded-xl border border-[#141414]/5 flex flex-col md:flex-row items-center gap-4">
              <div className="flex bg-[#F5F5F0] p-1 rounded-lg w-full md:w-auto">
                {(['all', 'added', 'removed', 'modified'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all ${
                      activeTab === tab 
                        ? 'bg-[#141414] text-white shadow-lg' 
                        : 'text-[#141414]/50 hover:text-[#141414]'
                    }`}
                  >
                    {tab === 'all' && t.all}
                    {tab === 'added' && t.added}
                    {tab === 'removed' && t.removed}
                    {tab === 'modified' && t.modified}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 w-full">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input 
                  type="text"
                  placeholder={t.searchPlaceholder}
                  className="w-full bg-[#F5F5F0] border-none rounded-lg py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#141414]/10 transition-all placeholder:opacity-30"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-[#141414]/10">
                  <Info className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="text-[#141414]/40 font-serif italic text-lg">{t.noResults}</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <DiffRecord 
                    key={item.id} 
                    item={item} 
                    t={t} 
                    lang={lang}
                    getDisplayName={getDisplayName}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </main>
      
      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-6 py-12 mt-12 border-t border-[#141414]/5 text-center">
        <p className="text-xs text-[#141414]/30 font-mono uppercase tracking-[0.2em] mb-4">GEDCOM Nexus • Genealogy Diff Tool</p>
        <div className="flex items-center justify-center gap-8 opacity-20">
          <FileText className="w-5 h-5" />
          <Users className="w-5 h-5" />
          <RefreshCcw className="w-5 h-5" />
        </div>
      </footer>
    </div>
  );
}

function UploadCard({ id, label, fileName, onUpload, t }: { id: string; label: string; fileName?: string; onUpload: (e: ChangeEvent<HTMLInputElement>) => void; t: any }) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-[#141414]/5 flex flex-col items-center justify-center text-center gap-4 group transition-all hover:shadow-xl hover:-translate-y-1">
      <div className={`p-5 rounded-2xl transition-all ${fileName ? 'bg-green-50 text-green-500' : 'bg-[#F5F5F0] text-[#141414]/30 group-hover:bg-[#141414] group-hover:text-white'}`}>
        {fileName ? <CheckCircle2 className="w-8 h-8" /> : <FileUp className="w-8 h-8" />}
      </div>
      <div>
        <span className="text-[10px] uppercase font-mono tracking-widest opacity-40 block mb-1">{label}</span>
        <h3 className="font-serif italic text-lg">{fileName || t.chooseFile}</h3>
      </div>
      <label htmlFor={id} className="cursor-pointer bg-[#141414] text-white px-6 py-2 rounded-full text-sm font-medium hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-black/10">
        {t.uploadBtn}
        <input id={id} type="file" accept=".ged" className="hidden" onChange={onUpload} />
      </label>
      {fileName && <p className="text-[10px] font-mono opacity-40 mt-2 truncate max-w-[200px]">{fileName}</p>}
    </div>
  );
}

const dmp = new DiffMatchPatch();

function ClassicDiff({ oldText, newText, t }: { oldText: string, newText: string, t: any }) {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  // Split logic for side-by-side
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];

  diffs.forEach(([type, text], i) => {
    if (type === 0) { // Unchanged
      left.push(<span key={`l-${i}`} className="opacity-40">{text}</span>);
      right.push(<span key={`r-${i}`} className="opacity-40">{text}</span>);
    } else if (type === -1) { // Removed
      left.push(<span key={`l-${i}`} className="bg-red-100 text-red-800 px-0.5 rounded border border-red-200">{text}</span>);
    } else if (type === 1) { // Added
      right.push(<span key={`r-${i}`} className="bg-green-100 text-green-800 px-0.5 rounded border border-green-200">{text}</span>);
    }
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <span className="text-[9px] uppercase font-mono opacity-30 tracking-tight">{t.original}</span>
        <div className="font-mono text-[11px] whitespace-pre-wrap break-all p-4 bg-white rounded-xl border border-[#141414]/5 leading-relaxed min-h-[200px] max-h-[500px] overflow-auto">
          {left}
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-[9px] uppercase font-mono opacity-30 tracking-tight">{t.updated}</span>
        <div className="font-mono text-[11px] whitespace-pre-wrap break-all p-4 bg-white rounded-xl border border-[#141414]/5 leading-relaxed min-h-[200px] max-h-[500px] overflow-auto">
          {right}
        </div>
      </div>
    </div>
  );
}

function SmartDiff({ record, t, lang }: { record: any, t: any, lang: string }) {
  return (
    <div className="grid gap-4">
      {record.changes.map((change: any, i: number) => {
        const oldValue = typeof change.oldValue === 'object' ? JSON.stringify(change.oldValue) : String(change.oldValue || '-');
        const newValue = typeof change.newValue === 'object' ? JSON.stringify(change.newValue) : String(change.newValue || '-');

        return (
          <div key={i} className="group flex flex-col md:flex-row gap-4 p-5 bg-white rounded-2xl border border-[#141414]/5 transition-all hover:border-[#141414]/20 shadow-sm">
            <div className="md:w-1/4">
              <span className="text-[10px] font-mono font-bold text-[#141414]/30 uppercase tracking-[0.2em] block mb-2">{change.humanKey}</span>
              <div className="w-8 h-1 bg-amber-200 rounded-full group-hover:w-12 transition-all"></div>
            </div>
            
            <div className="flex-1 grid md:grid-cols-[1fr,auto,1fr] items-center gap-6">
              <div className="bg-red-50/30 p-3 rounded-lg border border-red-100/30">
                <p className="text-[9px] uppercase font-mono opacity-30 mb-1">{t.original}</p>
                <p className="text-sm text-red-900/60 line-through truncate" title={oldValue}>{oldValue}</p>
              </div>
              
              <div className="flex justify-center">
                <ArrowRight className={`w-4 h-4 text-[#141414]/10 ${lang === 'he' ? 'rotate-180' : ''}`} />
              </div>
              
              <div className="bg-green-50/50 p-3 rounded-lg border border-green-100/50">
                <p className="text-[9px] uppercase font-mono opacity-30 mb-1">{t.updated}</p>
                <p className="text-sm font-medium text-green-900" title={newValue}>{newValue}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ViewMode = 'smart' | 'diff' | 'raw';

function DiffRecord({ item, t, lang, getDisplayName, expanded, onToggle }: any) {
  const [viewMode, setViewMode] = useState<ViewMode>('smart');

  return (
    <motion.div 
      layout
      className="bg-white rounded-2xl border border-[#141414]/5 overflow-hidden transition-all hover:shadow-md hover:border-[#141414]/10"
    >
      <div 
        className={`p-4 cursor-pointer flex items-center justify-between ${expanded ? 'bg-[#FBFBFA]' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            item.type === 'added' ? 'bg-green-50 text-green-600' :
            item.type === 'removed' ? 'bg-red-50 text-red-600' :
            'bg-amber-50 text-amber-600'
          }`}>
            {item.tag === 'INDI' ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] opacity-40 uppercase tracking-tighter truncate">{item.id} • {item.tag === 'INDI' ? t.indi : t.fam}</p>
            <h3 className="font-medium text-[#141414] truncate">{getDisplayName(item)}</h3>
            {item.type === 'modified' && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.changes.slice(0, 3).map((change: any, i: number) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700/60 rounded font-mono uppercase tracking-tighter shadow-sm border border-amber-100/50">
                    {change.humanKey}
                  </span>
                ))}
                {item.changes.length > 3 && (
                  <span className="text-[9px] text-amber-600/50 font-mono">
                    +{item.changes.length - 3} {t.more}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className={`px-2 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase ${
            item.type === 'added' ? 'bg-green-100 text-green-700' :
            item.type === 'removed' ? 'bg-red-100 text-red-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {item.type === 'added' && t.addedLabel}
            {item.type === 'removed' && t.removedLabel}
            {item.type === 'modified' && t.modifiedLabel}
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 opacity-30" /> : <ChevronRight className={`w-4 h-4 opacity-30 ${lang === 'he' ? 'rotate-180' : ''}`} />}
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#141414]/5 bg-[#FBFBFA]"
          >
            <div className="p-6">
              {item.type === 'modified' && (
                <div className="flex gap-1 mb-6 p-1 bg-[#141414]/5 rounded-lg w-fit">
                  <button 
                    onClick={() => setViewMode('smart')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${
                      viewMode === 'smart' ? 'bg-white text-[#141414] shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]/60'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    {t.viewSmart}
                  </button>
                  <button 
                    onClick={() => setViewMode('diff')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${
                      viewMode === 'diff' ? 'bg-white text-[#141414] shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]/60'
                    }`}
                  >
                    <RefreshCcw className="w-3 h-3" />
                    {t.viewDiff}
                  </button>
                  <button 
                    onClick={() => setViewMode('raw')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${
                      viewMode === 'raw' ? 'bg-white text-[#141414] shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]/60'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    {t.viewRaw}
                  </button>
                </div>
              )}

              {item.type === 'modified' ? (
                <div className="space-y-6">
                  {viewMode === 'smart' && <SmartDiff record={item} t={t} lang={lang} />}
                  
                  {viewMode === 'diff' && (
                    <ClassicDiff 
                      oldText={JSON.stringify(item.oldData, null, 2)} 
                      newText={JSON.stringify(item.newData, null, 2)} 
                      t={t}
                    />
                  )}

                  {viewMode === 'raw' && (
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase font-mono tracking-widest opacity-40">{t.originVer}</h4>
                        <pre className="text-xs bg-white p-4 rounded-xl border border-[#141414]/5 overflow-auto max-h-60 leading-relaxed font-mono">
                          {JSON.stringify(item.oldData, null, 2)}
                        </pre>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase font-mono tracking-widest opacity-40">{t.newVer}</h4>
                        <pre className="text-xs bg-white p-4 rounded-xl border border-[#141414]/5 overflow-auto max-h-60 leading-relaxed font-mono">
                          {JSON.stringify(item.newData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase font-mono tracking-widest opacity-40">{t.recordData}</h4>
                  <pre className="text-xs bg-white p-4 rounded-xl border border-[#141414]/5 overflow-auto max-h-60 leading-relaxed font-mono">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: ReactNode; color: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-[10px] uppercase font-mono tracking-wider opacity-40">{label}</p>
        <p className="text-2xl font-serif italic">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${color}`}>
        {icon}
      </div>
    </div>
  );
}
