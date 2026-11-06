import { useEffect, useState } from "react";
import { ProgressChart } from "../components/ProgressChart";
import { download, safeFilename, sessionToMarkdown } from "../lib/export";
import { weakestCriteria } from "../lib/scoring";
import { deleteSession, listSessions, type AppSettings } from "../lib/storage";
import { CRITERION_LABEL, type Session } from "../lib/types";

function status(s: Session): string {
  if (s.final) return "Selesai";
  if (!s.outline) return "Belum ada kerangka";
  if (s.paragraphs.every((p) => p.attempts.length === 0)) return "Kerangka siap";
  return `Menulis paragraf ${Math.min(s.current + 1, s.paragraphs.length)}/${s.paragraphs.length}`;
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export function HomeScreen({ settings }: { settings: AppSettings }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);

  const refresh = () => listSessions().then(setSessions);
  useEffect(() => {
    refresh();
  }, []);

  const finished = (sessions ?? []).filter((s) => s.final).reverse();
  const ranked = weakestCriteria(sessions ?? []);
  // Only suggest a focus when some criteria are clearly weaker than others (or low overall).
  const best = ranked.at(-1)?.avg ?? 0;
  const weak = ranked.filter((r) => r.avg < best || r.avg < 7).slice(0, 2);

  const remove = async (s: Session) => {
    if (!confirm(`Hapus sesi "${s.outline?.title ?? "tanpa judul"}"?`)) return;
    await deleteSession(s.id);
    refresh();
  };

  return (
    <div className="stack">
      {!settings.apiKey && !settings.baseUrl && (
        <div className="notice warn">
          API key Claude belum diisi. <a href="#/settings">Isi di Pengaturan</a> sebelum mulai berlatih.
        </div>
      )}

      <section className="card hero">
        <h1>Latihan menulis berbasis kata kunci</h1>
        <p className="muted">
          Beri bahan referensi, AI menyiapkan kerangka dan kata kunci, lalu Anda menulis paragrafnya sendiri. Setiap paragraf
          dinilai dari pemakaian kata kunci dan kualitas tulisan.
        </p>
        <a className="btn primary" href="#/new">Mulai latihan baru</a>
      </section>

      {finished.length > 0 && (
        <section className="card">
          <h2>Progres</h2>
          <ProgressChart
            points={finished.map((s) => ({
              label: new Date(s.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
              title: s.outline?.title ?? "",
              keyword: s.final!.avgKeywordPct,
              quality: s.final!.avgQualityPct,
            }))}
          />
          {weak.length > 0 && (
            <p>
              <strong>Saran fokus latihan:</strong> kriteria yang paling sering lemah adalah{" "}
              {weak.map((w, i) => (
                <span key={w.criterion}>
                  {i > 0 && " dan "}
                  <strong>{CRITERION_LABEL[w.criterion].toLowerCase()}</strong> (rata-rata {w.avg}/10)
                </span>
              ))}
              .
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2>Riwayat sesi</h2>
        {sessions === null ? (
          <p className="muted">Memuat…</p>
        ) : sessions.length === 0 ? (
          <p className="muted">Belum ada sesi. Mulai latihan pertama Anda.</p>
        ) : (
          <div className="table-wrap">
            <table className="history">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Judul</th>
                  <th>Jenis</th>
                  <th className="num">Skor akhir</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{fmtDate(s.createdAt)}</td>
                    <td>
                      <a href={`#/session/${s.id}`}>{s.outline?.title ?? "(tanpa judul)"}</a>
                      <div className="muted small">{status(s)}</div>
                    </td>
                    <td>{s.config.writingType}</td>
                    <td className="num">
                      {s.final ? (
                        <>
                          <strong>{s.final.adjustedScore}</strong>
                          <div className="muted small">{s.final.predicate}</div>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="actions">
                      {s.final && (
                        <button
                          className="btn small"
                          onClick={() => download(`${safeFilename(s.outline!.title)}.md`, sessionToMarkdown(s))}
                        >
                          Unduh
                        </button>
                      )}
                      <button className="btn small ghost" onClick={() => remove(s)} aria-label="Hapus sesi">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
