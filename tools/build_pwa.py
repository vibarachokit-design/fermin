"""Genera manifest.webmanifest y sw.js (lista de archivos + versión) para instalar el juego como app.

Ejecutar después de cualquier cambio en el juego:  python tools/build_pwa.py   (desde la carpeta juego)
La versión cambia sola cuando cambia cualquier archivo, y así los dispositivos instalados se actualizan.
"""
from pathlib import Path
import hashlib, json

GAME = Path(__file__).resolve().parent.parent
SKIP_DIRS = {'tools', '.git', '.claude'}
SKIP_FILES = {'README.md', 'sw.js'}

MANIFEST = {
    'name': 'El Vuelo del Gaviotín',
    'short_name': 'Gaviotín',
    'description': 'Juego educativo sobre la conservación del Gaviotín Chico en Mejillones.',
    'lang': 'es',
    'start_url': './',
    'scope': './',
    'display': 'fullscreen',
    'display_override': ['fullscreen', 'standalone'],
    'orientation': 'landscape',
    'background_color': '#0b2233',
    'theme_color': '#0E4C6E',
    'categories': ['games', 'education'],
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}

SW = r"""/* Service worker de El Vuelo del Gaviotín (generado por tools/build_pwa.py; no editar a mano). */
const VERSION = '__VERSION__';
const CACHE = 'gaviotin-' + VERSION;
const CORE = __CORE__;
const ALL = __ALL__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
  // El resto (música, fondos) se guarda en segundo plano para jugar sin internet.
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    for (const url of ALL) {
      if (!(await c.match(url))) { try { await c.add(url); } catch (_) { /* se reintenta al usarse */ } }
    }
  }));
});

async function fromCache(req) {
  const c = await caches.open(CACHE);
  let res = await c.match(req, { ignoreSearch: true });
  if (!res) {
    res = await fetch(req.url.split('#')[0]);
    if (res.ok && res.status === 200) c.put(req.url.split('?')[0], res.clone());
  }
  return res;
}

// Los <audio> piden rangos de bytes: se responden desde la copia guardada.
async function rangeResponse(req) {
  const res = await fromCache(new Request(req.url));
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  const start = m && m[1] ? +m[1] : 0;
  const end = m && m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range')) { e.respondWith(rangeResponse(req)); return; }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(fromCache(req).catch(() => caches.match(req, { ignoreSearch: true })));
});
"""


def main():
    (GAME / 'manifest.webmanifest').write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding='utf-8')
    files = []
    for p in sorted(GAME.rglob('*')):
        rel = p.relative_to(GAME)
        if p.is_file() and rel.parts[0] not in SKIP_DIRS and p.name not in SKIP_FILES:
            files.append(rel.as_posix())
    h = hashlib.sha256()
    for f in files:
        h.update(f.encode()); h.update((GAME / f).read_bytes())
    version = h.hexdigest()[:12]
    core = ['./', 'index.html', 'game.js', 'manifest.webmanifest'] + [
        f for f in files if f.startswith(('icons/', 'assets/ui/', 'assets/screens/', 'assets/sprites/', 'assets/items/'))]
    rest = [f for f in files if f not in core and f != 'index.html']
    sw = (SW.replace('__VERSION__', version)
            .replace('__CORE__', json.dumps(core, indent=0))
            .replace('__ALL__', json.dumps(rest, indent=0)))
    (GAME / 'sw.js').write_text(sw, encoding='utf-8')
    size = sum((GAME / f).stat().st_size for f in files) / 1e6
    print(f'sw.js versión {version}: {len(core)} archivos base + {len(rest)} en segundo plano ({size:.1f} MB en total)')


if __name__ == '__main__':
    main()
