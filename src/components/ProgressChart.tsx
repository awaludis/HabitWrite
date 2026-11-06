import { useState } from "react";

export interface ProgressPoint {
  label: string; // date label
  title: string;
  keyword: number; // 0–100 %
  quality: number; // 0–100 %
}

const W = 640;
const H = 240;
const PAD = { top: 16, right: 84, bottom: 28, left: 36 };

/** Line chart of keyword % and quality % per finished session (oldest → newest). */
export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / 100) * ih;
  const path = (key: "keyword" | "quality") => points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[key])}`).join(" ");
  const last = points[points.length - 1];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * iw;
    const i = points.length === 1 ? 0 : Math.round((px / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  // Keep end labels from colliding.
  let ky = y(last.keyword);
  let qy = y(last.quality);
  if (Math.abs(ky - qy) < 14) {
    const mid = (ky + qy) / 2;
    if (last.keyword >= last.quality) [ky, qy] = [mid - 7, mid + 7];
    else [ky, qy] = [mid + 7, mid - 7];
  }

  return (
    <figure className="viz-root chart">
      <div className="legend" aria-hidden="true">
        <span><i className="swatch s1" />Skor kata kunci (%)</span>
        <span><i className="swatch s2" />Skor kualitas (%)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik skor kata kunci dan skor kualitas per sesi">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + iw} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.left - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}</text>
          </g>
        ))}
        {points.map((p, i) =>
          points.length <= 8 || i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0 ? (
            <text key={i} x={x(i)} y={H - 8} className="axis" textAnchor="middle">{p.label}</text>
          ) : null,
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="crosshair" />}
        <path d={path("keyword")} className="line s1" />
        <path d={path("quality")} className="line s2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.keyword)} r={hover === i ? 5 : 4} className="dot s1" />
            <circle cx={x(i)} cy={y(p.quality)} r={hover === i ? 5 : 4} className="dot s2" />
          </g>
        ))}
        <text x={x(points.length - 1) + 10} y={ky + 4} className="endlabel">Kata kunci {Math.round(last.keyword)}</text>
        <text x={x(points.length - 1) + 10} y={qy + 4} className="endlabel">Kualitas {Math.round(last.quality)}</text>
        <rect
          x={PAD.left}
          y={PAD.top}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{points[hover].title}</strong>
          <div className="muted">{points[hover].label}</div>
          <div><i className="swatch s1" />Kata kunci: {points[hover].keyword.toFixed(0)}%</div>
          <div><i className="swatch s2" />Kualitas: {points[hover].quality.toFixed(0)}%</div>
        </div>
      )}
    </figure>
  );
}
