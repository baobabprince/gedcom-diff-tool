#!/usr/bin/env python3
from pathlib import Path

def main():
    p = Path('src/App.tsx')
    t = p.read_text()
    if "params.get('baobab')" in t or 'baobab=shared' in t:
        print('already')
        return
    if 'handleLoadShared' not in t:
        raise SystemExit('handleLoadShared missing')
    effect = '''
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('baobab') === 'shared') {
        handleLoadShared('A');
        params.delete('baobab');
        const next = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (next ? '?' + next : '') + window.location.hash);
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

'''
    idx = t.find('  return (')
    if idx < 0:
        raise SystemExit('return not found')
    t = t[:idx] + effect + t[idx:]
    p.write_text(t)
    print('ok', p.stat().st_size)

if __name__ == '__main__':
    main()
