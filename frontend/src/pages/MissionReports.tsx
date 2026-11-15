import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Toggle } from '@/components/ui/Toggle';
import { buildMissionReport, type ReportIncludes, type ReportResult } from '@/lib/report';
import { downloadBlob, relativeTime } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { CheckCircle2, Download, FileDown, FileText, Loader2, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

export function MissionReports() {
  const { snapshot } = useTelemetry();
  const [period, setPeriod] = useState(6);
  const [preparedBy, setPreparedBy] = useState('Mission Control Operator');
  const [includes, setIncludes] = useState<ReportIncludes>({
    vitals: true,
    anomalies: true,
    witness: true,
    risk: true,
    system: true,
  });
  const [reports, setReports] = useState<ReportResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setGenerating(true);
    setError(null);
    window.setTimeout(() => {
      try {
        const result = buildMissionReport(snapshot, { periodHours: period, includes, preparedBy });
        setReports((prev) => [result, ...prev].slice(0, 6));
        downloadBlob(result.blob, result.filename);
      } catch (err) {
        setError((err as Error).message || 'Report generation failed.');
      } finally {
        setGenerating(false);
      }
    }, 700);
  };

  const exportJson = () => {
    downloadBlob(
      new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }),
      `vitalis-snapshot-${snapshot.mission.id}.json`,
    );
  };

  const toggle = (key: keyof ReportIncludes, value: boolean) =>
    setIncludes((prev) => ({ ...prev, [key]: value }));

  const anomalies = snapshot.anomaly.log;

  return (
    <div>
      <PageHeader
        eyebrow="Documentation · demo export"
        title="Mission Reports"
        description="Assemble a printable mission summary from the current simulation session. The PDF is generated entirely in the browser — no telemetry leaves this machine."
        actions={
          <>
            <Badge tone="cyan">SIMULATED REPORT</Badge>
            <Button size="sm" variant="outline" onClick={exportJson}>
              <Download size={12} /> Snapshot JSON
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Panel
            bracket
            eyebrow="Report builder"
            title="Mission Report Configuration"
            bodyClassName="p-4"
            actions={<Badge tone="neutral">{snapshot.mission.id} · {snapshot.astronaut.id}</Badge>}
            footer={
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                A4 · multi-page · generated locally via jsPDF
              </span>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="label-xs mb-1.5">Monitoring period</div>
                <Segmented
                  label="Monitoring period"
                  options={[
                    { value: 1, label: '1h' },
                    { value: 6, label: '6h' },
                    { value: 24, label: '24h' },
                    { value: 0, label: 'Session' },
                  ]}
                  value={period}
                  onChange={(v) => setPeriod(Number(v))}
                />
              </div>
              <div>
                <label htmlFor="prepared-by" className="label-xs mb-1.5 block">
                  Prepared by
                </label>
                <input
                  id="prepared-by"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="h-8 w-full rounded border border-line bg-base px-2 text-[11px] text-ink outline-none focus:border-cyan/50"
                  placeholder="Operator name"
                />
              </div>
            </div>

            <div className="mt-4 rounded border border-line-soft bg-base/30 p-2">
              <div className="label-xs px-1">Included sections</div>
              <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
                <Toggle
                  id="inc-vitals"
                  label="Vital statistics"
                  checked={includes.vitals}
                  onChange={(v) => toggle('vitals', v)}
                />
                <Toggle
                  id="inc-anomalies"
                  label="Detected anomalies"
                  checked={includes.anomalies}
                  onChange={(v) => toggle('anomalies', v)}
                />
                <Toggle
                  id="inc-witness"
                  label="Witness channel results"
                  checked={includes.witness}
                  onChange={(v) => toggle('witness', v)}
                />
                <Toggle
                  id="inc-risk"
                  label="Risk score history"
                  checked={includes.risk}
                  onChange={(v) => toggle('risk', v)}
                />
                <Toggle
                  id="inc-system"
                  label="System summary"
                  checked={includes.system}
                  onChange={(v) => toggle('system', v)}
                />
              </div>
            </div>

            <div className="mt-3 rounded border border-line-soft bg-base/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="label-xs">Report preview</span>
                <StatusBadge status={snapshot.anomaly.status} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[9.5px]">
                {[
                  ['Mission', snapshot.mission.id],
                  ['Astronaut', snapshot.astronaut.id],
                  ['Period', period === 0 ? 'Full session' : `Last ${period} h`],
                  ['Risk score', `${snapshot.anomaly.score}/100`],
                  ['Windows flagged', `${snapshot.fusion.flaggedCount}/4`],
                  ['Witness channels', `${snapshot.fusion.witnesses.length}`],
                  ['Anomaly events', `${anomalies.length}`],
                  ['Model', `${snapshot.model.name} · ${snapshot.model.version}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-line-soft/60 py-0.5">
                    <dt className="uppercase tracking-micro text-muted">{k}</dt>
                    <dd className="text-right text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-micro text-amber">
                <ShieldAlert size={10} /> Contains simulated data only
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded border border-red/30 bg-red/[0.06] px-3 py-2 text-[10px] text-red">
                {error}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={generate} disabled={generating}>
                {generating ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                {generating ? 'Generating PDF…' : 'Generate demo PDF'}
              </Button>
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                Downloads automatically
              </span>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-3 xl:col-span-5">
          <Panel
            bracket
            eyebrow="Session vitals · summary"
            title="At a Glance"
            bodyClassName="p-0"
            actions={<Badge tone="cyan">DEMO</Badge>}
          >
            <div className="grid grid-cols-2 gap-px bg-line-soft">
              {[
                ['Heart rate', `${snapshot.vitals.hr} BPM`],
                ['HRV', `${snapshot.vitals.hrv} ms`],
                ['SpO₂', `${snapshot.vitals.spo2.toFixed(1)}%`],
                ['Skin temp', `${snapshot.vitals.temp.toFixed(2)}°C`],
                ['Activity', snapshot.vitals.activityLabel],
                ['Sleep score', `${snapshot.vitals.sleep}/100`],
              ].map(([label, value]) => (
                <div key={label} className="bg-panel px-3 py-2.5">
                  <div className="font-mono text-[8px] uppercase tracking-micro text-muted">{label}</div>
                  <div className="mt-0.5 font-mono text-[15px] text-ink">{value}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-line-soft px-3 py-2 text-[9.5px] leading-relaxed text-muted">
              Vitals printed in the PDF are captured at generation time and may differ from the live
              dashboard a moment later.
            </div>
          </Panel>

          <Panel
            eyebrow="Generated documents"
            title="Recent Reports"
            actions={<Badge tone="neutral">{reports.length}</Badge>}
            bodyClassName="p-0"
            footer={
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                Stored in memory for this session only
              </span>
            }
          >
            {reports.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  icon={<FileText size={20} />}
                  title="No reports generated yet"
                  description="Configure the sections above and generate the first demo PDF. It will appear here for re-download during this session."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {reports.map((report) => (
                  <li key={`${report.filename}-${report.generatedAt}`} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-cyan/25 bg-cyan/[0.07] text-cyan">
                      <CheckCircle2 size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[9.5px] text-ink">{report.filename}</div>
                      <div className="mt-0.5 font-mono text-[8px] uppercase tracking-micro text-muted">
                        {report.periodLabel} · {report.pages} pages ·{' '}
                        {(report.bytes / 1024).toFixed(0)} KB · {relativeTime(report.generatedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadBlob(report.blob, report.filename)}
                      aria-label={`Download ${report.filename}`}
                      title="Download report"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line text-muted hover:border-cyan/40 hover:text-cyan"
                    >
                      <Download size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-line/70 bg-panel/40 px-4 py-3">
        <p className="text-[10px] leading-relaxed text-muted">
          <span className="font-mono uppercase tracking-micro text-ink">Report integrity note ·</span>{' '}
          This document is a design demonstration of the Stage 5 dashboard deliverable. It contains
          no real astronaut health information, is not affiliated with NASA, and is not medical
          guidance. Risk scores are experimental inferences from simulated signal deviations.
        </p>
      </div>
    </div>
  );
}
