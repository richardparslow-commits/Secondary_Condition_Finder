"use client";

import { useCallback, useId, useRef, useState } from "react";

import { MIN_TIMELINE_YEAR, MAX_TIMELINE_YEAR } from "@/lib/secondary-workflow/state";

// Local copies to keep this client component free of server-only KB imports
// (composition audit forbids "use client" → @/lib/kb/*).
type NexusClassification = "DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY";
type SecondaryPathwayType =
  | "direct-secondary"
  | "aggravation"
  | "medication-related"
  | "treatment-complication"
  | "biomechanical"
  | "intermediate-chain"
  | "disease-progression"
  | "somatopsychic"
  | "neuroautonomic"
  | "adaptive-equipment"
  | "care-obstacle";

export interface TimelineConditionInput {
  id: string;
  name: string;
  bodySystem: string;
  isServiceConnected: boolean;
  onsetYear?: number;
  diagnosisYear?: number;
}

export interface TimelineConnectionInput {
  primaryId: string;
  primaryName: string;
  secondaryId: string;
  secondaryName: string;
  nexusClassification?: NexusClassification;
  pathways?: SecondaryPathwayType[];
  etiologicalConsensus?: string;
  hasChronologyWarning: boolean;
}

interface ConditionTimelineVisualizationProps {
  conditions: TimelineConditionInput[];
  connections: TimelineConnectionInput[];
}

// Colors map to global palette
const PATHWAY_COLOR: Record<string, string> = {
  "direct-secondary": "#1d4ed8",
  aggravation: "#b45309",
  "medication-related": "#7c3aed",
  "treatment-complication": "#dc2626",
  biomechanical: "#0d9488",
  "intermediate-chain": "#7c3aed",
  "disease-progression": "#475569",
  somatopsychic: "#6366f1",
  neuroautonomic: "#0891b2",
  "adaptive-equipment": "#57534e",
  "care-obstacle": "#57534e",
};

const NEXUS_COLOR: Record<string, string> = {
  DIRECT_CAUSATION: "#1d4ed8",
  AGGRAVATION: "#b45309",
  ASSOCIATION_ONLY: "#64748b",
};

function connectionColor(conn: TimelineConnectionInput): string {
  if (conn.pathways && conn.pathways.length > 0) {
    const first = conn.pathways[0];
    if (PATHWAY_COLOR[first]) return PATHWAY_COLOR[first];
  }
  if (conn.nexusClassification && NEXUS_COLOR[conn.nexusClassification]) {
    return NEXUS_COLOR[conn.nexusClassification];
  }
  return "#475569";
}

function primaryYear(c: TimelineConditionInput): number | undefined {
  return c.onsetYear ?? c.diagnosisYear;
}

function conditionsWithTimeline(
  conditions: TimelineConditionInput[],
): TimelineConditionInput[] {
  return conditions.filter((c) => c.onsetYear !== undefined || c.diagnosisYear !== undefined);
}

function computeRange(conditions: TimelineConditionInput[]): { min: number; max: number } | null {
  const years = conditions.flatMap((c) =>
    [c.onsetYear, c.diagnosisYear].filter((y): y is number => y !== undefined),
  );
  if (years.length === 0) return null;
  const minRaw = Math.min(...years);
  const maxRaw = Math.max(...years);
  const span = maxRaw - minRaw;
  const pad = span <= 2 ? 3 : span <= 6 ? 2 : 1;
  let min = Math.max(MIN_TIMELINE_YEAR, minRaw - pad);
  let max = Math.min(MAX_TIMELINE_YEAR, maxRaw + pad);
  if (max - min < 5) {
    // ensure at least 5-year window centred
    const center = Math.round((minRaw + maxRaw) / 2);
    min = Math.max(MIN_TIMELINE_YEAR, center - 3);
    max = Math.min(MAX_TIMELINE_YEAR, center + 3);
    if (max - min < 5) max = Math.min(MAX_TIMELINE_YEAR, min + 5);
  }
  return { min, max };
}

export function ConditionTimelineVisualization({
  conditions,
  connections,
}: ConditionTimelineVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hoverConn, setHoverConn] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    body: string;
  } | null>(null);

  const dated = conditionsWithTimeline(conditions);
  const range = computeRange(conditions);
  const hasAnyTimeline = dated.length > 0;
  // sort lanes: diagnosed not-SC? Actually split.
  const scConditions = [...conditions]
    .filter((c) => c.isServiceConnected)
    .sort((a, b) => (primaryYear(a) ?? 9999) - (primaryYear(b) ?? 9999) || a.name.localeCompare(b.name));
  const nscConditions = [...conditions]
    .filter((c) => !c.isServiceConnected)
    .sort((a, b) => (primaryYear(a) ?? 9999) - (primaryYear(b) ?? 9999) || a.name.localeCompare(b.name));
  const ordered = [...scConditions, ...nscConditions];

  // geometry
  const baseWidth = 860;
  const laneHeight = 48;
  const laneGap = 10;
  const headerH = 56;
  const legendH = 34;
  const topPad = 12;
  const leftPad = 64;
  const rightPad = 24;
  const bottomPad = 18;
  const contentW = Math.round(baseWidth * zoom);
  const contentH = headerH + topPad + ordered.length * (laneHeight + laneGap) + legendH + bottomPad;
  const axisY = headerH;
  const firstLaneY = headerH + topPad + 8;

  const xForYear = useCallback(
    (year: number) => {
      if (!range) return leftPad;
      const usable = contentW - leftPad - rightPad;
      const frac = (year - range.min) / Math.max(1, range.max - range.min);
      return leftPad + frac * usable;
    },
    [range, contentW],
  );

  const yForIndex = (index: number) => firstLaneY + index * (laneHeight + laneGap);

  // download
  const downloadSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secondary-timeline-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const downloadPng = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    // ensure white bg
    const scale = window.devicePixelRatio || 2;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(contentW * scale);
    canvas.height = Math.round(contentH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, contentW, contentH);
    ctx.drawImage(img, 0, 0, contentW, contentH);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `secondary-timeline-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    }, "image/png");
  }, [contentW, contentH]);

  // empty state
  if (!range || !hasAnyTimeline) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 id={titleId} className="text-base font-bold text-slate-900">
          Condition Timeline
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          No approximate years are available for this review yet. The timeline helps you verify{" "}
          <em>temporal relationships</em> required under the Spicer / M21-1 May 2026 “but for”
          causation standard — that a secondary condition would not have occurred but for the
          service-connected condition, or that the service-connected condition interfered with
          treatment.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>How to add dates:</strong> Return to{" "}
          <a href="/secondary/upload" className="underline">
            Step 4 — Supporting Documents
          </a>{" "}
          and enter an approximate <em>onset year</em> and/or <em>formal diagnosis year</em> for
          each diagnosed condition. Missing dates produce no chronology conclusion.
        </div>
        <p className="mt-3 text-sm text-muted">
          This visualization is a research aid. It does not determine nexus, diagnose conditions,
          or replace verification against current VA guidance and your medical records.
        </p>
      </div>
    );
  }

  const ticks: number[] = [];
  const span = range.max - range.min;
  const step = span <= 10 ? 1 : span <= 24 ? 2 : span <= 40 ? 5 : 10;
  for (let y = range.min; y <= range.max; y += step) ticks.push(y);
  if (ticks[ticks.length - 1] !== range.max) ticks.push(range.max);

  const idToIndex = new Map(ordered.map((c, i) => [c.id, i] as const));
  const idToCondition = new Map(ordered.map((c) => [c.id, c] as const));

  const legendItems: { label: string; color: string; dashed?: boolean }[] = [
    { label: "Direct causation", color: NEXUS_COLOR.DIRECT_CAUSATION },
    { label: "Aggravation", color: NEXUS_COLOR.AGGRAVATION },
    { label: "Association only", color: NEXUS_COLOR.ASSOCIATION_ONLY },
    { label: "Medication-related", color: PATHWAY_COLOR["medication-related"] },
    { label: "Intermediate chain", color: PATHWAY_COLOR["intermediate-chain"], dashed: true },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h3 id={titleId} className="text-sm font-bold text-slate-900">
            Condition Timeline Visualization
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600">
            Horizontal axis is calendar year. Each lane is one diagnosed condition. Lines connect an
            already service-connected primary to a non-service-connected diagnosis where the knowledge
            base has an authored relationship worth evaluating.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
              disabled={zoom <= 1}
              aria-label="Zoom out"
              className="rounded px-2 py-1 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[3.5rem] text-center text-xs font-medium text-slate-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
              disabled={zoom >= 2.5}
              aria-label="Zoom in"
              className="rounded px-2 py-1 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="ml-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={downloadSvg}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Download SVG
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Download PNG
          </button>
        </div>
      </div>

      {/* legend bar */}
      <div className="flex flex-wrap gap-3 border-b border-slate-100 bg-white px-4 py-2 text-xs">
        {legendItems.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-5 rounded"
              style={{
                background: item.color,
                borderTop: item.dashed ? `2px dashed ${item.color}` : `2px solid ${item.color}`,
                height: item.dashed ? 0 : 3,
              }}
            />
            <span className="text-slate-600">{item.label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-slate-600">Chronology question</span>
        </span>
      </div>

      <div
        ref={wrapperRef}
        className="relative overflow-x-auto overflow-y-hidden bg-white"
        style={{ maxWidth: "100%" }}
        onMouseLeave={() => {
          setTooltip(null);
          setHoverConn(null);
        }}
      >
        <svg
          ref={svgRef}
          role="img"
          aria-labelledby={titleId}
          width={contentW}
          height={contentH}
          viewBox={`0 0 ${contentW} ${contentH}`}
          className="block select-none"
          style={{ minWidth: contentW, background: "#ffffff" }}
        >
          <title id={titleId}>Condition timeline from {range.min} to {range.max}</title>
          <desc>
            Interactive timeline showing {scConditions.length} already service-connected and{" "}
            {nscConditions.length} not-service-connected conditions with authored causal connectors
            color-coded by pathway type.
          </desc>

          {/* axis line */}
          <line
            x1={leftPad}
            x2={contentW - rightPad}
            y1={axisY}
            y2={axisY}
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
          {/* axis ticks */}
          {ticks.map((year) => {
            const x = xForYear(year);
            return (
              <g key={year}>
                <line x1={x} x2={x} y1={axisY - 6} y2={axisY + 6} stroke="#94a3b8" strokeWidth={1} />
                <text
                  x={x}
                  y={axisY - 12}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#334155"
                >
                  {year}
                </text>
                {/* vertical grid */}
                <line
                  x1={x}
                  x2={x}
                  y1={axisY + 6}
                  y2={contentH - legendH - bottomPad}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                  strokeDasharray={year === range.min || year === range.max ? undefined : "4 6"}
                />
              </g>
            );
          })}
          <text x={leftPad} y={axisY - 26} fontSize={10} fontWeight={700} fill="#64748b" letterSpacing={0.06 * 12}>
            CALENDAR YEAR →
          </text>

          {/* band dividers + labels */}
          {scConditions.length > 0 && nscConditions.length > 0 && (
            <>
              <rect
                x={8}
                y={firstLaneY - 6}
                width={contentW - 16}
                height={scConditions.length * (laneHeight + laneGap) - laneGap + 12}
                rx={10}
                fill="#eff6ff"
                stroke="#dbeafe"
              />
              <text
                x={14}
                y={firstLaneY - 12}
                fontSize={9}
                fontWeight={800}
                fill="#1d4ed8"
                letterSpacing={0.08 * 10}
              >
                ALREADY SERVICE CONNECTED
              </text>
              <rect
                x={8}
                y={firstLaneY + scConditions.length * (laneHeight + laneGap) + 6}
                width={contentW - 16}
                height={nscConditions.length * (laneHeight + laneGap) - laneGap + 12}
                rx={10}
                fill="#fffbeb"
                stroke="#fde68a"
              />
              <text
                x={14}
                y={firstLaneY + scConditions.length * (laneHeight + laneGap) - 0}
                fontSize={9}
                fontWeight={800}
                fill="#92400e"
                letterSpacing={0.08 * 10}
              >
                DIAGNOSED, NOT SERVICE CONNECTED
              </text>
            </>
          )}

          {/* connections — rendered under lanes */}
          {connections.map((conn) => {
            const sIdx = idToIndex.get(conn.primaryId);
            const tIdx = idToIndex.get(conn.secondaryId);
            if (sIdx === undefined || tIdx === undefined) return null;
            const src = idToCondition.get(conn.primaryId);
            const tgt = idToCondition.get(conn.secondaryId);
            const srcYear = src ? primaryYear(src) : undefined;
            const tgtYear = tgt ? primaryYear(tgt) : undefined;
            if (srcYear === undefined || tgtYear === undefined) return null;
            const x1 = xForYear(srcYear);
            const x2 = xForYear(tgtYear);
            const y1 = yForIndex(sIdx) + laneHeight / 2;
            const y2 = yForIndex(tIdx) + laneHeight / 2;
            const color = connectionColor(conn);
            const key = `${conn.primaryId}→${conn.secondaryId}`;
            const isHover = hoverConn === key;
            const isWarn = conn.hasChronologyWarning;
            const dashed = conn.pathways?.includes("intermediate-chain");
            // curve control
            const mx = (x1 + x2) / 2;
            const dx = Math.abs(x2 - x1);
            const curve = Math.min(24, Math.max(8, dx * 0.15)) * (y2 > y1 ? 1 : -1);
            return (
              <g
                key={key}
                onMouseEnter={() => {
                  setHoverConn(key);
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  setTooltip({
                    x: midX,
                    y: midY,
                    title: `${conn.primaryName} → ${conn.secondaryName}`,
                    body: `${conn.nexusClassification ?? "relationship"} · ${conn.etiologicalConsensus ?? ""}${
                      isWarn ? " · chronology question" : ""
                    }${conn.pathways?.length ? ` · ${conn.pathways.join(", ")}` : ""}`,
                  });
                }}
                onMouseLeave={() => {
                  setHoverConn(null);
                  setTooltip(null);
                }}
                style={{ cursor: "pointer" }}
              >
                <path
                  d={`M ${x1} ${y1} C ${mx} ${y1 + curve}, ${mx} ${y2 - curve}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isWarn ? "#f59e0b" : color}
                  strokeWidth={isHover ? 3.5 : 2.2}
                  strokeDasharray={dashed ? "8 6" : isWarn ? "6 4" : undefined}
                  strokeLinecap="round"
                  opacity={isHover ? 1 : 0.88}
                />
                {/* arrow head */}
                <polygon
                  points={`${x2},${y2} ${x2 - 7},${y2 - 3.5} ${x2 - 7},${y2 + 3.5}`}
                  fill={isWarn ? "#f59e0b" : color}
                  opacity={isHover ? 1 : 0.88}
                  transform={`rotate(${y2 > y1 ? 12 : -12} ${x2} ${y2})`}
                />
                {/* hit area */}
                <path
                  d={`M ${x1} ${y1} C ${mx} ${y1 + curve}, ${mx} ${y2 - curve}, ${x2} ${y2}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                />
              </g>
            );
          })}

          {/* lanes */}
          {ordered.map((cond, idx) => {
            const y = yForIndex(idx);
            const yr = primaryYear(cond);
            const x = yr !== undefined ? xForYear(yr) : leftPad + 8;
            const isActive = activeId === cond.id;
            const isSC = cond.isServiceConnected;
            const warning = connections.some(
              (c) =>
                (c.primaryId === cond.id || c.secondaryId === cond.id) && c.hasChronologyWarning,
            );
            const hasAnyConn =
              connections.some((c) => c.primaryId === cond.id || c.secondaryId === cond.id) ||
              false;
            return (
              <g key={cond.id}>
                {/* lane bg */}
                <rect
                  x={leftPad - 48}
                  y={y}
                  width={contentW - leftPad - rightPad + 48}
                  height={laneHeight}
                  rx={10}
                  fill={isActive ? "#f8fafc" : "#ffffff"}
                  stroke={isActive ? "#94a3b8" : "#e2e8f0"}
                  strokeWidth={isActive ? 1.5 : 1}
                />
                {/* left color strip */}
                <rect
                  x={leftPad - 48}
                  y={y}
                  width={4}
                  height={laneHeight}
                  rx={2}
                  fill={isSC ? "#1d4ed8" : "#d97706"}
                />
                {/* year marker line */}
                {yr !== undefined && (
                  <line
                    x1={x}
                    x2={x}
                    y1={y + 4}
                    y2={y + laneHeight - 4}
                    stroke={isSC ? "#bfdbfe" : "#fde68a"}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                )}
                {/* condition label (left) */}
                <text
                  x={leftPad - 40}
                  y={y + 16}
                  fontSize={12}
                  fontWeight={700}
                  fill="#0f172a"
                  style={{ cursor: "pointer" }}
                  onClick={() => setActiveId((v) => (v === cond.id ? null : cond.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId((v) => (v === cond.id ? null : cond.id));
                    }
                  }}
                  aria-label={`${cond.name} ${yr ?? ""}`}
                >
                  {cond.name.length > 38 ? `${cond.name.slice(0, 38)}…` : cond.name}
                </text>
                <text x={leftPad - 40} y={y + 30} fontSize={10} fill="#64748b">
                  {cond.bodySystem}
                  {hasAnyConn ? " · linked" : ""}
                  {warning ? " · chronology question" : ""}
                </text>
                {yr !== undefined && (
                  <text x={leftPad - 40} y={y + 42} fontSize={10} fontWeight={600} fill="#334155">
                    {cond.onsetYear !== undefined && cond.diagnosisYear !== undefined && cond.onsetYear !== cond.diagnosisYear
                      ? `onset ${cond.onsetYear} · dx ${cond.diagnosisYear}`
                      : cond.onsetYear !== undefined
                        ? `onset ${cond.onsetYear}${cond.diagnosisYear ? ` · dx ${cond.diagnosisYear}` : ""}`
                        : `dx ${cond.diagnosisYear}`}
                  </text>
                )}
                {yr === undefined && (
                  <text x={leftPad - 40} y={y + 42} fontSize={10} fill="#94a3b8" fontStyle="italic">
                    year not entered
                  </text>
                )}
                {/* dot marker */}
                {yr !== undefined && (
                  <g
                    onMouseEnter={() =>
                      setTooltip({
                        x: x + 10,
                        y: y + 10,
                        title: cond.name,
                        body: `${isSC ? "Already service connected" : "Diagnosed, not service connected"} · ${
                          cond.onsetYear !== undefined || cond.diagnosisYear !== undefined
                            ? `onset ${cond.onsetYear ?? "—"} · dx ${cond.diagnosisYear ?? "—"}`
                            : "year not entered"
                        } · ${cond.bodySystem}`,
                      })
                    }
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveId((v) => (v === cond.id ? null : cond.id))}
                    tabIndex={0}
                    role="button"
                    aria-label={`Details for ${cond.name}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveId((v) => (v === cond.id ? null : cond.id));
                      }
                    }}
                    onFocus={() =>
                      setTooltip({
                        x: x + 10,
                        y: y + 10,
                        title: cond.name,
                        body: `${isSC ? "Already service connected" : "Diagnosed, not service connected"} · onset ${cond.onsetYear ?? "—"} · dx ${cond.diagnosisYear ?? "—"}`,
                      })
                    }
                    onBlur={() => setTooltip(null)}
                  >
                    <circle
                      cx={x}
                      cy={y + laneHeight / 2}
                      r={isActive ? 8 : 6.5}
                      fill={isSC ? "#1d4ed8" : "#d97706"}
                      stroke="#ffffff"
                      strokeWidth={2.5}
                    />
                    {warning && (
                      <circle
                        cx={x}
                        cy={y + laneHeight / 2}
                        r={isActive ? 11 : 9.5}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={1.6}
                        strokeDasharray="3 3"
                      />
                    )}
                    {isSC ? (
                      <text
                        x={x}
                        y={y + laneHeight / 2 + 3.5}
                        textAnchor="middle"
                        fontSize={7}
                        fontWeight={900}
                        fill="#ffffff"
                        pointerEvents="none"
                      >
                        SC
                      </text>
                    ) : null}
                  </g>
                )}
                {yr === undefined && (
                  <circle
                    cx={leftPad + 16}
                    cy={y + laneHeight / 2}
                    r={4}
                    fill="#e2e8f0"
                    stroke="#94a3b8"
                    strokeWidth={1}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* html tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 max-w-[min(22rem,90%)] rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl"
            style={{
              left: Math.min(contentW - 240, Math.max(8, tooltip.x)),
              top: Math.max(8, tooltip.y - 56),
            }}
            role="status"
            aria-live="polite"
          >
            <div className="font-semibold">{tooltip.title}</div>
            <div className="mt-0.5 text-slate-200">{tooltip.body}</div>
          </div>
        )}
      </div>

      {/* table fallback + footer */}
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Text alternative — year table (for screen readers &amp; printing)
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-2 py-1.5 font-semibold">Condition</th>
                  <th className="px-2 py-1.5 font-semibold">Service-connected?</th>
                  <th className="px-2 py-1.5 font-semibold">Onset</th>
                  <th className="px-2 py-1.5 font-semibold">Diagnosis</th>
                  <th className="px-2 py-1.5 font-semibold">Body system</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 font-medium text-slate-900">{c.name}</td>
                    <td className="px-2 py-1.5">{c.isServiceConnected ? "Yes" : "No"}</td>
                    <td className="px-2 py-1.5">{c.onsetYear ?? "—"}</td>
                    <td className="px-2 py-1.5">{c.diagnosisYear ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600">{c.bodySystem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {connections.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold text-slate-700">Authored connectors shown</p>
              <ul className="mt-1 list-disc pl-5 text-slate-600">
                {connections.map((conn) => (
                  <li key={`${conn.primaryId}-${conn.secondaryId}`}>
                    {conn.primaryName} → {conn.secondaryName}
                    {conn.pathways?.length ? ` (${conn.pathways.join(", ")})` : ""}
                    {conn.hasChronologyWarning ? " — chronology question" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          <strong>How to read this:</strong> Dots are placed at the condition’s approximate year
          (onset preferred, otherwise diagnosis). Lines are drawn only where the curated knowledge
          base contains an authored relationship between a service-connected condition you selected
          and a diagnosed non-service-connected condition. Color indicates pathway type; dashed
          indicates an intermediate-chain two-step path; amber halo/outline flags a chronology
          question to resolve with records. Missing years mean no marker can be placed — this is
          not a negative finding.
        </p>
      </div>
    </div>
  );
}
