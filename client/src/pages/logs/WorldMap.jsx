import React, { useMemo } from 'react';

/**
 * Lightweight world map — zero dependencies.
 * Uses an equirectangular projection (linear lon/lat → x/y) over a public
 * equirectangular base image, so dots land in the right place without d3/leaflet.
 *
 * props.points: [{ lat, lon, count, label, suspicious }]
 */
const BASE_MAP = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg';

const project = (lat, lon) => ({
  left: ((Number(lon) + 180) / 360) * 100,
  top: ((90 - Number(lat)) / 180) * 100,
});

const WorldMap = ({ points = [], height = 360 }) => {
  // Merge points that share (rounded) coordinates so overlapping cities stack into one dot
  const dots = useMemo(() => {
    const map = new Map();
    points.forEach((p) => {
      if (p.lat == null || p.lon == null) return;
      const key = `${Number(p.lat).toFixed(1)},${Number(p.lon).toFixed(1)}`;
      const ex = map.get(key);
      if (ex) {
        ex.count += p.count || 1;
        ex.suspicious = ex.suspicious || p.suspicious;
      } else {
        map.set(key, { lat: p.lat, lon: p.lon, count: p.count || 1, label: p.label, suspicious: p.suspicious });
      }
    });
    return [...map.values()];
  }, [points]);

  const maxCount = Math.max(1, ...dots.map(d => d.count));

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-700/50 bg-slate-950"
      style={{ height }}
    >
      {/* Base map (grayscaled + dimmed to fit the dark theme). Falls back to gradient if it fails to load. */}
      <img
        src={BASE_MAP}
        alt="world map"
        className="absolute inset-0 w-full h-full object-fill opacity-40"
        style={{ filter: 'grayscale(1) brightness(0.55) contrast(1.1)' }}
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      {/* Graticule fallback */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.15) 1px, transparent 1px)',
          backgroundSize: '8.33% 8.33%',
        }}
      />

      {dots.map((d, i) => {
        const { left, top } = project(d.lat, d.lon);
        const size = 8 + Math.round((d.count / maxCount) * 16); // 8–24px
        const color = d.suspicious ? 'rgba(244,63,94,0.85)' : 'rgba(52,211,153,0.85)';
        const glow = d.suspicious ? 'rgba(244,63,94,0.5)' : 'rgba(52,211,153,0.5)';
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${left}%`, top: `${top}%` }}
            title={`${d.label || ''} · ${d.count}`}
          >
            <span
              className="block rounded-full animate-pulse"
              style={{ width: size, height: size, background: color, boxShadow: `0 0 ${size}px ${glow}` }}
            />
            <span className="absolute left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[10px] font-bold text-slate-200 bg-slate-900/80 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
              {d.label || ''} · {d.count}
            </span>
          </div>
        );
      })}

      {!dots.length && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          אין נתוני מיקום להצגה
        </div>
      )}
    </div>
  );
};

export default WorldMap;
