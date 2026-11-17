/* Service worker de El Vuelo del Gaviotín (generado por tools/build_pwa.py; no editar a mano). */
const VERSION = 'cbcbbe18c1cf';
const CACHE = 'gaviotin-' + VERSION;
const CORE = [
"./",
"index.html",
"game.js",
"manifest.webmanifest",
"assets/items/chick_beg.png",
"assets/items/chick_eat.png",
"assets/items/chick_sit.png",
"assets/items/chick_sleep.png",
"assets/items/fact_card.png",
"assets/items/nest_eggs.png",
"assets/items/pair_nest.png",
"assets/items/sea_boat.png",
"assets/items/sea_lion.png",
"assets/items/sea_net.png",
"assets/items/sea_pelican.png",
"assets/items/sea_pelican_dive.png",
"assets/items/tool_cone.png",
"assets/items/tool_detour.png",
"assets/items/tool_fence.png",
"assets/items/tool_hat.png",
"assets/items/tool_lamp.png",
"assets/items/tool_sign.png",
"assets/items/trash_bag.png",
"assets/items/trash_bottle.png",
"assets/items/trash_cap.png",
"assets/items/trash_line.png",
"assets/items/trash_rings.png",
"assets/screens/25_screen_title.webp",
"assets/screens/26_screen_victory.webp",
"assets/screens/27_screen_game_over.webp",
"assets/screens/title_cover.webp",
"assets/sprites/air.png",
"assets/sprites/desert.png",
"assets/sprites/fish.png",
"assets/sprites/icons.png",
"assets/sprites/tern_dive.png",
"assets/sprites/tern_flight.png",
"assets/sprites/tern_states.png",
"assets/ui/firma.png",
"assets/ui/logo.png",
"icons/apple-touch-icon.png",
"icons/favicon-64.png",
"icons/icon-192.png",
"icons/icon-512.png",
"icons/icon-maskable-512.png"
];
const ALL = [
"assets/audio/amb_bay.mp3",
"assets/audio/amb_desert_day.mp3",
"assets/audio/amb_desert_night.mp3",
"assets/audio/amb_ocean_wind.mp3",
"assets/audio/amb_underwater.mp3",
"assets/audio/music_fact_card.mp3",
"assets/audio/music_game_over.mp3",
"assets/audio/music_phase1_migration.mp3",
"assets/audio/music_phase2_fishing.mp3",
"assets/audio/music_phase3_day.mp3",
"assets/audio/music_phase3_night.mp3",
"assets/audio/music_phase_clear.mp3",
"assets/audio/music_title.mp3",
"assets/audio/music_victory.mp3",
"assets/audio/sfx_atv_loop.mp3",
"assets/audio/sfx_bad.mp3",
"assets/audio/sfx_bubbles.mp3",
"assets/audio/sfx_card_open.mp3",
"assets/audio/sfx_click.mp3",
"assets/audio/sfx_dive.mp3",
"assets/audio/sfx_dog_sniff.mp3",
"assets/audio/sfx_falcon_dive.mp3",
"assets/audio/sfx_falcon_warning.mp3",
"assets/audio/sfx_feed_chicks.mp3",
"assets/audio/sfx_fish_catch.mp3",
"assets/audio/sfx_fish_gold.mp3",
"assets/audio/sfx_floodlight_hum.mp3",
"assets/audio/sfx_floodlight_on.mp3",
"assets/audio/sfx_footsteps_loop.mp3",
"assets/audio/sfx_good.mp3",
"assets/audio/sfx_gull.mp3",
"assets/audio/sfx_hurt.mp3",
"assets/audio/sfx_life_lost.mp3",
"assets/audio/sfx_nest_alarm.mp3",
"assets/audio/sfx_net_tangle.mp3",
"assets/audio/sfx_night_fall.mp3",
"assets/audio/sfx_pause.mp3",
"assets/audio/sfx_pelican.mp3",
"assets/audio/sfx_sea_lion.mp3",
"assets/audio/sfx_splash.mp3",
"assets/audio/sfx_splash_out.mp3",
"assets/audio/sfx_star.mp3",
"assets/audio/sfx_tern_call.mp3",
"assets/audio/sfx_threat_leaves.mp3",
"assets/audio/sfx_tired.mp3",
"assets/audio/sfx_tool_detour.mp3",
"assets/audio/sfx_tool_fence.mp3",
"assets/audio/sfx_tool_lamp.mp3",
"assets/audio/sfx_tool_sign.mp3",
"assets/audio/sfx_trash_hit.mp3",
"assets/audio/sfx_truck_loop.mp3",
"assets/audio/sfx_wind_gust.mp3",
"assets/audio/sfx_wing_flap.mp3",
"assets/bg/13_bg_migration_far_sky.webp",
"assets/bg/14_bg_migration_distant_mountains.webp",
"assets/bg/15_bg_migration_middle_clouds.webp",
"assets/bg/16_bg_migration_near_ocean.webp",
"assets/bg/17_bg_mejillones_sky.webp",
"assets/bg/18_bg_mejillones_far_hills_port.webp",
"assets/bg/19_bg_mejillones_water_surface.webp",
"assets/bg/20_bg_mejillones_underwater.webp",
"assets/bg/21_bg_pampa_warm_sky.webp",
"assets/bg/22_bg_pampa_far_horizon.webp",
"assets/bg/23_bg_pampa_middle_ground.webp",
"assets/bg/24_bg_pampa_night_light_pollution.webp",
"assets/items.json"
];

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
