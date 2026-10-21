#!/usr/bin/env python3
from pathlib import Path

BTN = '''            <a
              href="https://baobabprince.github.io/anafim/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg border border-[#e7e8e0] bg-[#fefefb] text-[#456352] text-xs font-semibold hover:bg-[#edf1e9] transition-colors no-underline"
              title={lang === 'he' || lang === 'he-IL' ? 'פתיחת אותו אילן במבט משפחתי' : 'Open the same tree in family view'}
            >
              {(lang === 'he' || lang === 'he-IL') ? 'אילן המשפחה' : 'Family tree'}
            </a>
'''

def main():
    p = Path('src/App.tsx')
    t = p.read_text()
    if 'אילן המשפחה' in t:
        print('already')
        return
    needle = '''            <button 
              onClick={() => setShowLanguagePicker(!showLanguagePicker)}
'''
    if needle not in t:
        # alternate spacing
        needle = 'onClick={() => setShowLanguagePicker(!showLanguagePicker)}'
        if needle not in t:
            raise SystemExit('lang picker not found')
        # insert before the button that contains this
        idx = t.find(needle)
        # find start of button tag before idx
        start = t.rfind('<button', 0, idx)
        t = t[:start] + BTN + t[start:]
    else:
        t = t.replace(needle, BTN + needle, 1)
    p.write_text(t)
    print('ok')

if __name__ == '__main__':
    main()
