import { jsPDF } from 'jspdf';
import type { TelemetrySnapshot } from '@/lib/types';

type RGB = [number, number, number];

const BG: RGB = [7, 11, 20];
const CARD: RGB = [12, 20, 34];
const LINE: RGB = [27, 48, 71];
const INK: RGB = [234, 243, 255];
const MUTED: RGB = [130, 150, 173];
const CYAN: RGB = [53, 217, 242];
const AMBER: RGB = [255, 184, 77];
const GREEN: RGB = [53, 212, 154];
const RED: RGB = [255, 83, 100];

const A4 = { w: 595.28, h: 841.89 };
const M = 40;

export interface ReportIncludes {
  vitals: boolean;
  anomalies: boolean;
  witness: boolean;
  risk: boolean;
  system: boolean;
}

export interface ReportOptions {
  periodHours: number;
  includes: ReportIncludes;
  preparedBy: string;
}

export interface ReportResult {
  filename: string;
  blob: Blob;
  bytes: number;
  generatedAt: number;
  pages: number;
  periodLabel: string;
}

/** jsPDF core fonts are WinAnsi — normalise scientific symbols to ASCII. */
const clean = (value: string) =>
  value
    .replace(/SpO₂/g, 'SpO2')
    .replace(/σ/g, 'sigma')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/↔/g, '<->')
    .replace(/Ω/g, 'Omega')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/ {2,}/g, ' ');

const stamp = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(
    date.getUTCDate(),
  ).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}${String(
    date.getUTCMinutes(),
  ).padStart(2, '0')}`;

const utc = (value: number) => {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(
    d.getUTCMinutes(),
  ).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}Z`;
};

/**
 * Builds the demo PDF entirely in the browser. Everything printed is simulated
 * telemetry; the cover and footer state that explicitly.
 */
export function buildMissionReport(snapshot: TelemetrySnapshot, options: ReportOptions): ReportResult {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const now = new Date();
  const periodLabel = options.periodHours === 0 ? 'Full session' : `Last ${options.periodHours} h`;
  let y = 0;
  let section = 0;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const text = (value: string, x: number, at: number, opts?: { align?: 'left' | 'right' | 'center' }) =>
    doc.text(clean(value), x, at, opts);

  const paint = () => {
    fill(BG);
    doc.rect(0, 0, A4.w, A4.h, 'F');
  };

  const newPage = () => {
    doc.addPage();
    paint();
    fill(CYAN);
    doc.rect(0, 0, A4.w, 1.5, 'F');
    y = 66;
  };

  const ensure = (height: number) => {
    if (y + height > A4.h - 46) newPage();
  };

  const sectionHeader = (label: string) => {
    section += 1;
    ensure(36);
    ink(CYAN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    text(`${String(section).padStart(2, '0')} / ${label.toUpperCase()}`, M, y);
    y += 7;
    stroke(LINE);
    doc.setLineWidth(0.6);
    doc.line(M, y, A4.w - M, y);
    y += 14;
  };

  /* ------------------------------- cover ------------------------------- */
  paint();
  fill(CYAN);
  doc.rect(0, 0, A4.w, 2.5, 'F');
  fill([16, 28, 45]);
  doc.roundedRect(M, 42, 22, 22, 3, 3, 'F');
  stroke(CYAN);
  doc.setLineWidth(0.7);
  doc.roundedRect(M + 4, 46, 14, 14, 2, 2, 'S');

  ink(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  text('VITALIS', M + 32, 58);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  ink(MUTED);
  text('MISSION HEALTH INTELLIGENCE  /  ASTRONAUT PHYSIOLOGICAL REPORT', M + 32, 70);

  ink(AMBER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  text('SIMULATED DEMO REPORT', A4.w - M, 56, { align: 'right' });
  ink(MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  text('NO NASA AFFILIATION  ·  NO LIVE ASTRONAUT DATA', A4.w - M, 66, { align: 'right' });

  stroke(LINE);
  doc.setLineWidth(0.7);
  doc.line(M, 84, A4.w - M, 84);
  y = 106;

  /* ------------------------------ metadata ----------------------------- */
  const meta: Array<[string, string]> = [
    ['MISSION ID', snapshot.mission.id],
    ['ASTRONAUT ID', snapshot.astronaut.id],
    ['MONITORING PERIOD', periodLabel],
    ['GENERATED (UTC)', utc(Date.now())],
    ['DATA SOURCE', 'SIMULATED · local demo engine · no wearable link'],
    ['PIPELINE', `CAE-4W · threshold ${snapshot.model.thresholdRule}`],
    ['MISSION PHASE', snapshot.mission.phase],
    ['PREPARED BY', options.preparedBy || 'Mission Control Operator'],
  ];
  const colW = (A4.w - 2 * M - 20) / 2;
  meta.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = M + col * (colW + 20);
    const at = y + row * 22;
    ink(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    text(label, x, at);
    ink(INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    text(value, x, at + 9);
  });
  y += Math.ceil(meta.length / 2) * 22 + 10;

  /* ------------------------------ vitals ------------------------------- */
  if (options.includes.vitals) {
    sectionHeader('Vital statistics');
    const v = snapshot.vitals;
    const vitals = [
      ['HEART RATE', `${v.hr}`, 'BPM'],
      ['HRV (RMSSD)', `${v.hrv}`, 'ms'],
      ['SpO2', `${v.spo2.toFixed(1)}`, '%'],
      ['SKIN TEMPERATURE', `${v.temp.toFixed(2)}`, 'deg C'],
      ['ACTIVITY', v.activityLabel, `index ${Math.round(v.activity)}`],
      ['SLEEP / RECOVERY', `${v.sleep}`, '/ 100'],
    ];
    const boxW = (A4.w - 2 * M - 16) / 3;
    const boxH = 50;
    vitals.forEach(([label, value, unit], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = M + col * (boxW + 8);
      const at = y + row * (boxH + 8);
      fill(CARD);
      stroke(LINE);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, at, boxW, boxH, 2.5, 2.5, 'FD');
      ink(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      text(label, x + 9, at + 13);
      ink(INK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      text(value, x + 9, at + 32);
      ink(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      text(unit, x + 9, at + 41);
    });
    y += 2 * (boxH + 8) + 4;
  }

  /* ----------------------------- anomalies ----------------------------- */
  if (options.includes.anomalies) {
    sectionHeader('Detected anomalies');
    const rows = snapshot.anomaly.log.slice(0, 6);
    const cols = [M, M + 62, M + 150, M + 235, M + 295, M + 355];
    fill([16, 28, 45]);
    doc.rect(M, y - 8, A4.w - 2 * M, 16, 'F');
    ink(MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    ['EVENT ID', 'UTC', 'STATUS', 'RISK', 'WINDOWS', 'WITNESS'].forEach((label, i) =>
      text(label, cols[i], y + 3),
    );
    y += 16;
    if (rows.length === 0) {
      ink(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      text('No anomaly events recorded in this session.', M, y + 6);
      y += 20;
    } else {
      rows.forEach((row) => {
        ensure(20);
        stroke([22, 38, 58]);
        doc.setLineWidth(0.4);
        doc.line(M, y + 6, A4.w - M, y + 6);
        ink(INK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        text(row.id, cols[0], y + 1);
        ink(MUTED);
        doc.setFont('helvetica', 'normal');
        text(utc(row.detectedAt), cols[1], y + 1);
        ink(row.status === 'confirmed' ? RED : AMBER);
        doc.setFont('helvetica', 'bold');
        text(row.status.toUpperCase(), cols[2], y + 1);
        ink(INK);
        doc.setFont('helvetica', 'normal');
        text(`${row.score}/100`, cols[3], y + 1);
        text(`${row.windowsFlagged}/${row.windowCount}`, cols[4], y + 1);
        text(row.witnesses.length ? row.witnesses.join(', ').toUpperCase() : 'NONE', cols[5], y + 1);
        y += 17;
      });
    }
    ink(MUTED);
    doc.setFontSize(6);
    text(
      `Abnormal window count in current evaluation: ${snapshot.anomaly.flaggedWindows}/4 · mean reconstruction error ${snapshot.anomaly.reconstructionError.toFixed(
        4,
      )} vs threshold ${snapshot.anomaly.threshold.toFixed(4)}.`,
      M,
      y + 8,
    );
    y += 22;
  }

  /* ------------------------------ witness ------------------------------ */
  if (options.includes.witness) {
    sectionHeader('Witness channel results');
    const cols = [M, M + 120, M + 250, M + 345, M + 420];
    fill([16, 28, 45]);
    doc.rect(M, y - 8, A4.w - 2 * M, 16, 'F');
    ink(MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    ['CHANNEL', 'VERDICT', 'SCORE', 'THRESHOLD', 'SUPPORTING'].forEach((label, i) =>
      text(label, cols[i], y + 3),
    );
    y += 16;
    snapshot.witnesses.forEach((w) => {
      ensure(18);
      stroke([22, 38, 58]);
      doc.setLineWidth(0.4);
      doc.line(M, y + 6, A4.w - M, y + 6);
      ink(INK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      text(w.label, cols[0], y + 1);
      ink(w.status === 'anomaly' ? RED : w.status === 'nodata' ? MUTED : GREEN);
      text(w.status.toUpperCase(), cols[1], y + 1);
      ink(MUTED);
      doc.setFont('helvetica', 'normal');
      text(w.status === 'nodata' ? '-' : `${w.score.toFixed(2)}x`, cols[2], y + 1);
      text(`${w.threshold.toFixed(2)}x`, cols[3], y + 1);
      text(w.supporting ? 'YES' : 'NO', cols[4], y + 1);
      y += 16;
    });
    ensure(6);
    ink(MUTED);
    doc.setFontSize(6);
    const note =
      'Witness rule: when HRV triggers, auxiliary channels are scored in the same window. At least one co-affected channel confirms the event; otherwise it remains suspected.';
    doc.splitTextToSize(clean(note), A4.w - 2 * M).forEach((line: string) => {
      ensure(12);
      text(line, M, y);
      y += 9;
    });
    y += 8;
  }

  /* ---------------------------- risk history --------------------------- */
  if (options.includes.risk) {
    sectionHeader('Risk score history');
    const boxH = 126;
    ensure(boxH + 16);
    const boxY = y;
    fill([10, 19, 32]);
    stroke(LINE);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, boxY, A4.w - 2 * M, boxH, 3, 3, 'FD');
    const plotX = M + 34;
    const plotY = boxY + 14;
    const plotW = A4.w - 2 * M - 50;
    const plotH = boxH - 34;
    ['100', '75', '50', '25', '0'].forEach((label, i) => {
      const gy = plotY + (plotH / 4) * i;
      stroke([22, 38, 58]);
      doc.setLineWidth(0.35);
      doc.line(plotX, gy, plotX + plotW, gy);
      ink(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      text(label, M + 8, gy + 2);
    });

    // suspected threshold band
    const thresholdY = plotY + plotH * (1 - 60 / 100);
    doc.setLineDashPattern([2, 2], 0);
    stroke(AMBER);
    doc.setLineWidth(0.5);
    doc.line(plotX, thresholdY, plotX + plotW, thresholdY);
    doc.setLineDashPattern([], 0);
    ink(AMBER);
    doc.setFontSize(5);
    text('SUSPECTED 60', plotX + plotW - 2, thresholdY - 3, { align: 'right' });

    const hist = snapshot.anomaly.history.slice(-120);
    if (hist.length > 1) {
      stroke(CYAN);
      doc.setLineWidth(1);
      for (let i = 1; i < hist.length; i++) {
        const x1 = plotX + ((i - 1) / (hist.length - 1)) * plotW;
        const x2 = plotX + (i / (hist.length - 1)) * plotW;
        const y1 = plotY + plotH * (1 - hist[i - 1].score / 100);
        const y2 = plotY + plotH * (1 - hist[i].score / 100);
        doc.line(x1, y1, x2, y2);
      }
    }
    ink(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    text(`T-${hist.length}s`, plotX, plotY + plotH + 10);
    text('NOW', plotX + plotW, plotY + plotH + 10, { align: 'right' });
    text('RISK 0-100', M + 8, boxY + 8);
    y = boxY + boxH + 14;
  }

  /* ---------------------------- system notes --------------------------- */
  if (options.includes.system) {
    sectionHeader('System summary');
    const summary = [
      `Overall status: ${snapshot.anomaly.status.toUpperCase()} · risk ${snapshot.anomaly.score}/100.`,
      `Model ${snapshot.model.name} (${snapshot.model.architecture}), baseline ${snapshot.model.baselineWindows} windows.`,
      `Threshold rule: ${snapshot.model.thresholdRule}; window set ${snapshot.model.windowSet.join(' / ')} s.`,
      `Fusion: ${snapshot.fusion.flaggedCount} of 4 windows flagged (rule ${snapshot.fusion.rule}); witness channels ${snapshot.fusion.witnesses.length}.`,
      `Transport: simulated · ${snapshot.health.sampleRateHz} Hz · link ${snapshot.health.link}.`,
      'Interpretation: monitoring flag inferred from multi-channel physiological signal deviations. No disease or direct biomarker is measured; clinical confirmation would be required.',
    ];
    summary.forEach((line) => {
      const wrapped: string[] = doc.splitTextToSize(clean(line), A4.w - 2 * M - 12);
      ensure(wrapped.length * 9 + 6);
      fill(CYAN);
      doc.circle(M + 2, y - 2, 1.2, 'F');
      ink(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      wrapped.forEach((segment) => {
        text(segment, M + 10, y);
        y += 9;
      });
      y += 4;
    });
  }

  /* ------------------------------ footer ------------------------------- */
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    stroke(LINE);
    doc.setLineWidth(0.5);
    doc.line(M, A4.h - 34, A4.w - M, A4.h - 34);
    ink(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    text('VITALIS · SIMULATED DEMO REPORT · NOT A MEDICAL DIAGNOSIS', M, A4.h - 23);
    text(`PAGE ${page} / ${pages}`, A4.w - M, A4.h - 23, { align: 'right' });
  }

  const blob = doc.output('blob');
  return {
    filename: `vitalis-report-${snapshot.mission.id}-${stamp(now)}.pdf`,
    blob,
    bytes: blob.size,
    generatedAt: Date.now(),
    pages,
    periodLabel,
  };
}
