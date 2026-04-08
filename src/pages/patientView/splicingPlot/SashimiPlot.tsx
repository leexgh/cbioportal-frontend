import * as React from 'react';
import { observer } from 'mobx-react';
import { computed, observable, action, makeObservable } from 'mobx';
import {
    WhippetPsiEvent,
    GtfTranscript,
    GtfExon,
    SpliceJunction,
    JunctionArc,
    BIOTYPE_SHORT,
} from './SplicingTypes';
import {
    buildJunctionArcs,
    buildArcsFromPsi,
    mapEventsToExons,
    inferTranscripts,
} from './SplicingPlotUtils';

// ─── Publication-quality palette ────────────────────────────────────────────
const C = {
    bg: '#FFFFFF',
    border: '#DEE2E6',
    text: '#212529',
    textMed: '#495057',
    textLight: '#868E96',
    textFaint: '#ADB5BD',
    grid: '#F1F3F5',
    axis: '#CED4DA',
    // Exons
    exon: '#4263EB',
    exonStroke: '#364FC7',
    cassette: '#E03131',
    cassetteStroke: '#C92A2A',
    // Arcs
    arcConst: '#4263EB',
    arcSkip: '#E03131',
    arcIncl: '#2F9E44',
    // Coverage
    covFill: '#D0EBFF',
    covStroke: '#4263EB',
    covCassette: '#FFE3E3',
    covCassetteStroke: '#E03131',
    // PSI
    psiIncluded: '#2F9E44',
    psiSkipped: '#E03131',
    psiPartial: '#E8590C',
    // Transcript
    txExon: '#495057',
    txLine: '#CED4DA',
    mane: '#4263EB',
};

export interface ISashimiPlotProps {
    events: WhippetPsiEvent[];
    transcripts: GtfTranscript[];
    junctions: SpliceJunction[];
    geneId: string;
    geneName: string;
    sampleId?: string;
    width?: number;
    focusEventIndex?: number; // index into cassetteEvents to zoom on
    onClearFocus?: () => void;
}

@observer
export default class SashimiPlot extends React.Component<
    ISashimiPlotProps,
    {}
> {
    static defaultProps = { width: 1200 };

    @observable tipText = '';
    @observable tipX = 0;
    @observable tipY = 0;
    @observable tipShow = false;

    private mg = { top: 14, right: 36, bottom: 16, left: 56 };

    constructor(props: ISashimiPlotProps) {
        super(props);
        makeObservable(this);
    }

    // ── Data ──

    @computed get sorted() {
        return [...this.props.events].sort((a, b) => a.start - b.start);
    }
    @computed get chr() {
        return this.sorted[0]?.chr ?? '';
    }
    @computed get strand() {
        return this.sorted[0]?.strand ?? '+';
    }

    @computed get canonTx(): GtfTranscript | undefined {
        const t = this.props.transcripts;
        return t.find(x => x.isMane) || t.find(x => x.isCanonical) || t[0];
    }
    @computed get canonExons(): GtfExon[] {
        if (!this.canonTx) return [];
        return [...this.canonTx.exons].sort((a, b) => a.start - b.start);
    }

    @computed get relevantTx(): GtfTranscript[] {
        return this.props.transcripts
            .filter(
                t =>
                    t.biotype === 'protein_coding' ||
                    t.biotype === 'nonsense_mediated_decay' ||
                    t.biotype === 'retained_intron'
            )
            .slice(0, 6);
    }

    @computed get focusCE(): WhippetPsiEvent | undefined {
        const idx = this.props.focusEventIndex;
        if (idx !== undefined && idx >= 0 && idx < this.cassetteEvents.length) {
            return this.cassetteEvents[idx];
        }
        return undefined;
    }

    @computed get range(): [number, number] {
        const focus = this.focusCE;
        if (focus) {
            // Zoom: show ~1 exon on each side of the cassette exon
            const ceLen = focus.end - focus.start;
            const flanking = Math.max(ceLen * 6, 8000); // show enough context
            const mid = (focus.start + focus.end) / 2;
            // Find the neighboring canonical exons for better framing
            const prevExon = this.canonExons
                .filter(e => e.end < focus.start)
                .pop();
            const nextExon = this.canonExons.find(e => e.start > focus.end);
            const lo = prevExon
                ? Math.min(prevExon.start - 200, mid - flanking)
                : mid - flanking;
            const hi = nextExon
                ? Math.max(nextExon.end + 200, mid + flanking)
                : mid + flanking;
            const pad = (hi - lo) * 0.06;
            return [lo - pad, hi + pad];
        }
        const s = [
            ...this.sorted.map(e => e.start),
            ...this.canonExons.map(e => e.start),
        ];
        const e = [
            ...this.sorted.map(e => e.end),
            ...this.canonExons.map(e => e.end),
        ];
        const lo = Math.min(...s),
            hi = Math.max(...e),
            pad = (hi - lo) * 0.04;
        return [lo - pad, hi + pad];
    }
    @computed get span() {
        return this.range[1] - this.range[0];
    }
    @computed get pw() {
        return this.props.width! - this.mg.left - this.mg.right;
    }

    x = (p: number) =>
        this.mg.left + ((p - this.range[0]) / this.span) * this.pw;

    // Heights
    get arcH() {
        return 110;
    }
    get covH() {
        return 70;
    }
    get geneH() {
        return 28;
    }
    get psiH() {
        return 22;
    }
    get txRowH() {
        return 20;
    }
    get txH() {
        return this.relevantTx.length * this.txRowH + 4;
    }

    // Arcs
    @computed get allArcs(): JunctionArc[] {
        if (this.props.junctions.length > 0 && this.canonExons.length > 0)
            return buildJunctionArcs(
                this.props.junctions,
                this.sorted,
                this.canonExons,
                this.chr
            );
        return buildArcsFromPsi(this.sorted);
    }
    // Show top arcs by reads to avoid clutter
    @computed get arcs(): JunctionArc[] {
        const sorted = [...this.allArcs].sort((a, b) => b.reads - a.reads);
        // Keep top 25 arcs, or all if fewer
        return sorted.slice(0, 25).sort((a, b) => a.fromEnd - b.fromEnd);
    }
    @computed get maxReads() {
        return Math.max(1, ...this.arcs.map(a => a.reads));
    }

    @computed get cassetteEvents() {
        return this.sorted.filter(e => e.type === 'CE');
    }
    // Only show PSI labels for interesting events (not PSI=1.00)
    @computed get notableCE() {
        return this.cassetteEvents.filter(
            e => e.psi < 0.8 || (e.psi >= 0 && e.psi < 0.95)
        );
    }

    // Coverage per exon
    @computed get exonCov(): Map<number, number> {
        const m = new Map<number, number>();
        for (const ex of this.canonExons) {
            let best = 0;
            for (const ev of this.sorted) {
                const ol = Math.max(
                    0,
                    Math.min(ev.end, ex.end) - Math.max(ev.start, ex.start) + 1
                );
                if (ol > (ex.end - ex.start + 1) * 0.3)
                    best = Math.max(best, ev.totalReads);
            }
            m.set(ex.num, best);
        }
        return m;
    }
    @computed get maxCov() {
        return Math.max(1, ...Array.from(this.exonCov.values()));
    }

    @computed get mappings() {
        return mapEventsToExons(this.sorted, this.relevantTx);
    }
    @computed get scores() {
        return inferTranscripts(this.mappings, this.relevantTx);
    }

    @action.bound showTip(t: string, x: number, y: number) {
        this.tipText = t;
        this.tipX = x;
        this.tipY = y;
        this.tipShow = true;
    }
    @action.bound hideTip() {
        this.tipShow = false;
    }

    // ── PSI label positions with collision avoidance ──
    psiLabels(yBase: number) {
        const labels = this.notableCE.map(ce => ({
            cx: this.x((ce.start + ce.end) / 2),
            psi: ce.psi,
            text: `Ψ = ${ce.psi.toFixed(2)}`,
            y: yBase,
        }));
        labels.sort((a, b) => a.cx - b.cx);
        // Three-row stagger for dense regions
        const MIN = 48;
        for (let i = 1; i < labels.length; i++) {
            const prev = labels[i - 1];
            if (labels[i].cx - prev.cx < MIN) {
                // Cycle through 3 rows
                const prevRow = (prev.y - yBase) / 11;
                const nextRow = (prevRow + 1) % 3;
                labels[i].y = yBase + nextRow * 11;
            }
        }
        return labels;
    }

    // ── Arc label collision avoidance ──
    arcLabels() {
        // Only label arcs with ≥ threshold reads
        const threshold = Math.max(3, this.maxReads * 0.02);
        const labeled = this.arcs.filter(a => a.reads >= threshold);
        type LabelInfo = { x: number; y: number; text: string; color: string };
        const positions: LabelInfo[] = [];
        for (const arc of labeled) {
            const x1 = this.x(arc.fromEnd),
                x2 = this.x(arc.toStart);
            const mx = (x1 + x2) / 2;
            const readFrac =
                Math.log(arc.reads + 1) / Math.log(this.maxReads + 1);
            const h = Math.max(18, readFrac * (this.arcH - 18));
            const color =
                arc.junctionType === 'skipping'
                    ? C.arcSkip
                    : arc.junctionType === 'inclusion'
                    ? C.arcIncl
                    : C.arcConst;
            positions.push({
                x: mx,
                y: -h - 2,
                text: String(arc.reads),
                color,
            });
        }
        // Resolve horizontal overlaps
        positions.sort((a, b) => a.x - b.x);
        for (let i = 1; i < positions.length; i++) {
            if (
                Math.abs(positions[i].x - positions[i - 1].x) < 28 &&
                Math.abs(positions[i].y - positions[i - 1].y) < 12
            ) {
                positions[i].y -= 11;
            }
        }
        return positions;
    }

    // ── Render ──

    renderHeader() {
        const nCE = this.cassetteEvents.length;
        const skipped = this.cassetteEvents.filter(c => c.psi < 0.3).length;
        const focus = this.focusCE;
        // Find exon number for focused event
        let focusExonNum = '?';
        if (focus) {
            for (const ex of this.canonExons) {
                const ol = Math.max(
                    0,
                    Math.min(focus.end, ex.end) -
                        Math.max(focus.start, ex.start) +
                        1
                );
                if (ol > (ex.end - ex.start + 1) * 0.3) {
                    focusExonNum = String(ex.num);
                    break;
                }
            }
        }
        return (
            <div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        padding: '10px 16px',
                        borderBottom: focus ? 'none' : `1px solid ${C.border}`,
                        background: '#FAFBFC',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 10,
                            flexWrap: 'wrap',
                        }}
                    >
                        <span
                            style={{
                                fontSize: 20,
                                fontWeight: 800,
                                color: C.text,
                                letterSpacing: -0.5,
                            }}
                        >
                            {this.props.geneName}
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                color: C.textLight,
                                fontFamily: 'monospace',
                            }}
                        >
                            {this.props.geneId}
                        </span>
                        <span style={{ fontSize: 11, color: C.textFaint }}>
                            chr{this.chr}:{(this.range[0] / 1e6).toFixed(2)}–
                            {(this.range[1] / 1e6).toFixed(2)} Mb
                        </span>
                        {nCE > 0 && !focus && (
                            <span
                                style={{
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    background:
                                        skipped > 0 ? '#FFE3E3' : '#E7F5FF',
                                    color: skipped > 0 ? C.cassette : C.exon,
                                }}
                            >
                                {nCE} cassette exons
                                {skipped > 0 ? ` · ${skipped} skipped` : ''}
                            </span>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: C.text,
                            }}
                        >
                            {this.props.sampleId}
                        </div>
                        <div style={{ fontSize: 10, color: C.textFaint }}>
                            {this.sorted.length} events · {this.allArcs.length}{' '}
                            junctions · {this.relevantTx.length} transcripts
                        </div>
                    </div>
                </div>
                {focus && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '8px 16px',
                            background: '#FFF5F5',
                            borderBottom: `1px solid ${C.border}`,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: C.cassette,
                            }}
                        >
                            🔍 Focused: Exon {focusExonNum} skipping
                        </span>
                        <span style={{ fontSize: 11, color: C.textMed }}>
                            Ψ = {focus.psi.toFixed(3)}
                            {focus.psi < 0.2
                                ? ' (mostly skipped)'
                                : focus.psi < 0.5
                                ? ' (partially skipped)'
                                : ' (mostly included)'}
                        </span>
                        <span
                            style={{
                                fontSize: 10,
                                color: C.textLight,
                                fontFamily: 'monospace',
                            }}
                        >
                            chr{this.chr}:{focus.start.toLocaleString()}–
                            {focus.end.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 10, color: C.textLight }}>
                            {focus.totalReads.toFixed(0)} reads
                        </span>
                        {this.props.onClearFocus && (
                            <button
                                onClick={this.props.onClearFocus}
                                style={{
                                    marginLeft: 'auto',
                                    fontSize: 11,
                                    padding: '3px 10px',
                                    borderRadius: 4,
                                    border: `1px solid ${C.border}`,
                                    background: '#fff',
                                    color: C.textMed,
                                    cursor: 'pointer',
                                }}
                            >
                                ← Show full gene
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    renderArcs(base: number) {
        const arcBase = base + this.arcH;
        const labels = this.arcLabels();
        return (
            <g>
                {this.arcs.map((arc, i) => {
                    const x1 = this.x(arc.fromEnd),
                        x2 = this.x(arc.toStart);
                    const readFrac =
                        Math.log(arc.reads + 1) / Math.log(this.maxReads + 1);
                    const h = Math.max(18, readFrac * (this.arcH - 18));
                    const isSkip = arc.junctionType === 'skipping';
                    const color = isSkip
                        ? C.arcSkip
                        : arc.junctionType === 'inclusion'
                        ? C.arcIncl
                        : C.arcConst;
                    // Skipping arcs are much thicker and fully opaque
                    const sw = isSkip
                        ? Math.max(3, Math.min(5, 2 + readFrac * 3))
                        : Math.max(1, Math.min(3.5, 1 + readFrac * 2.5));
                    const opacity = isSkip ? 1.0 : 0.7;
                    const path = `M ${x1},${arcBase} C ${x1},${arcBase -
                        h} ${x2},${arcBase - h} ${x2},${arcBase}`;
                    return (
                        <g key={`a${i}`}>
                            {/* Glow effect for skipping arcs */}
                            {isSkip && (
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={sw + 4}
                                    opacity={0.15}
                                />
                            )}
                            <path
                                d={path}
                                fill="none"
                                stroke={color}
                                strokeWidth={sw}
                                opacity={opacity}
                                strokeDasharray={isSkip ? undefined : undefined}
                                onMouseEnter={(e: any) =>
                                    this.showTip(
                                        `${arc.junctionType}${
                                            isSkip ? ' (exon-skipping)' : ''
                                        }\n${arc.reads} reads`,
                                        e.clientX,
                                        e.clientY
                                    )
                                }
                                onMouseLeave={this.hideTip}
                            />
                        </g>
                    );
                })}
                {/* Read count labels */}
                {labels.map((l, i) => (
                    <text
                        key={`al${i}`}
                        x={l.x}
                        y={arcBase + l.y}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={700}
                        fill={l.color}
                    >
                        {l.text}
                    </text>
                ))}
            </g>
        );
    }

    renderCoverage(base: number) {
        const h = this.covH;
        const maxC = this.maxCov;
        // Y-axis: 0 and max
        const ticks = [0, Math.round(maxC)];
        return (
            <g>
                {ticks.map((v, i) => {
                    const y = base + h - (v / maxC) * h;
                    return (
                        <g key={`yt${i}`}>
                            <line
                                x1={this.mg.left}
                                x2={this.mg.left + this.pw}
                                y1={y}
                                y2={y}
                                stroke={C.grid}
                                strokeWidth={0.5}
                            />
                            <text
                                x={this.mg.left - 5}
                                y={y + 3}
                                textAnchor="end"
                                fontSize={8}
                                fill={C.textFaint}
                            >
                                {v}
                            </text>
                        </g>
                    );
                })}
                <text
                    x={this.mg.left - 8}
                    y={base + h / 2}
                    textAnchor="end"
                    fontSize={8}
                    fill={C.textFaint}
                    transform={`rotate(-90,${this.mg.left - 8},${base +
                        h / 2})`}
                >
                    reads
                </text>
                {this.canonExons.map((ex, i) => {
                    const cov = this.exonCov.get(ex.num) || 0;
                    const x1 = this.x(ex.start);
                    const w = Math.max(4, this.x(ex.end) - x1);
                    const bh = (cov / maxC) * h;
                    const isCE = this.cassetteEvents.some(
                        e =>
                            Math.abs(e.start - ex.start) <= 5 &&
                            Math.abs(e.end - ex.end) <= 5
                    );
                    return (
                        <rect
                            key={`cv${i}`}
                            x={x1}
                            y={base + h - bh}
                            width={w}
                            height={bh}
                            fill={isCE ? C.covCassette : C.covFill}
                            stroke={isCE ? C.covCassetteStroke : C.covStroke}
                            strokeWidth={0.5}
                            rx={1}
                            opacity={0.8}
                            onMouseEnter={(e: any) =>
                                this.showTip(
                                    `Exon ${ex.num} · ${cov.toFixed(
                                        0
                                    )} reads\nchr${
                                        this.chr
                                    }:${ex.start.toLocaleString()}–${ex.end.toLocaleString()} (${(
                                        ex.end -
                                        ex.start +
                                        1
                                    ).toLocaleString()} bp)`,
                                    e.clientX,
                                    e.clientY
                                )
                            }
                            onMouseLeave={this.hideTip}
                        />
                    );
                })}
            </g>
        );
    }

    renderGeneModel(base: number) {
        const midY = base + this.geneH / 2;
        const exH = 16;
        const exons = this.canonExons;
        if (exons.length === 0) return null;
        const gS = exons[0].start,
            gE = exons[exons.length - 1].end;
        return (
            <g>
                {/* Intron line */}
                <line
                    x1={this.x(gS)}
                    x2={this.x(gE)}
                    y1={midY}
                    y2={midY}
                    stroke={C.axis}
                    strokeWidth={1}
                />
                {/* Strand arrows */}
                {exons.slice(0, -1).map((ex, i) => {
                    const next = exons[i + 1];
                    const mx = (this.x(ex.end) + this.x(next.start)) / 2;
                    const gap = this.x(next.start) - this.x(ex.end);
                    if (gap < 10) return null;
                    const d = this.strand === '+' ? 3.5 : -3.5;
                    return (
                        <g key={`ar${i}`}>
                            <line
                                x1={mx - d}
                                y1={midY - 3}
                                x2={mx}
                                y2={midY}
                                stroke={C.axis}
                                strokeWidth={0.8}
                            />
                            <line
                                x1={mx - d}
                                y1={midY + 3}
                                x2={mx}
                                y2={midY}
                                stroke={C.axis}
                                strokeWidth={0.8}
                            />
                        </g>
                    );
                })}
                {/* Exon rectangles */}
                {exons.map((ex, i) => {
                    const x1 = this.x(ex.start);
                    const w = Math.max(5, this.x(ex.end) - x1);
                    const matchedCE = this.cassetteEvents.find(
                        e =>
                            Math.abs(e.start - ex.start) <= 5 &&
                            Math.abs(e.end - ex.end) <= 5
                    );
                    const isCE = !!matchedCE;
                    const isSkipped = isCE && matchedCE!.psi < 0.3;
                    const isPartial =
                        isCE && !isSkipped && matchedCE!.psi < 0.8;
                    const patId = `hatch-${i}`;
                    return (
                        <g
                            key={`ge${i}`}
                            onMouseEnter={(e: any) =>
                                this.showTip(
                                    `Exon ${ex.num}\nchr${
                                        this.chr
                                    }:${ex.start.toLocaleString()}–${ex.end.toLocaleString()}\n${ex.end -
                                        ex.start +
                                        1} bp${
                                        isCE
                                            ? `\nΨ = ${matchedCE!.psi.toFixed(
                                                  3
                                              )} ${
                                                  isSkipped
                                                      ? '(SKIPPED)'
                                                      : isPartial
                                                      ? '(partial)'
                                                      : '(included)'
                                              }`
                                            : ''
                                    }`,
                                    e.clientX,
                                    e.clientY
                                )
                            }
                            onMouseLeave={this.hideTip}
                        >
                            {/* Diagonal hatch pattern for skipped exons */}
                            {isSkipped && (
                                <defs>
                                    <pattern
                                        id={patId}
                                        width="6"
                                        height="6"
                                        patternUnits="userSpaceOnUse"
                                        patternTransform="rotate(45)"
                                    >
                                        <line
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="6"
                                            stroke="#fff"
                                            strokeWidth="2"
                                            opacity="0.4"
                                        />
                                    </pattern>
                                </defs>
                            )}
                            <rect
                                x={x1}
                                y={midY - exH / 2}
                                width={w}
                                height={exH}
                                fill={isCE ? C.cassette : C.exon}
                                stroke={isCE ? C.cassetteStroke : C.exonStroke}
                                strokeWidth={isSkipped ? 2 : 0.8}
                                rx={1.5}
                                strokeDasharray={isSkipped ? '3,2' : undefined}
                                opacity={isSkipped ? 0.5 : 1}
                            />
                            {/* Hatch overlay for skipped */}
                            {isSkipped && (
                                <rect
                                    x={x1}
                                    y={midY - exH / 2}
                                    width={w}
                                    height={exH}
                                    fill={`url(#${patId})`}
                                    rx={1.5}
                                />
                            )}
                            {/* Exon number */}
                            {w > 16 && (
                                <text
                                    x={x1 + w / 2}
                                    y={midY + 3.5}
                                    textAnchor="middle"
                                    fontSize={w > 28 ? 8 : 7}
                                    fontWeight={600}
                                    fill="#fff"
                                >
                                    {ex.num}
                                </text>
                            )}
                            {/* "SKIPPED" label below the exon */}
                            {isSkipped && w > 10 && (
                                <text
                                    x={x1 + w / 2}
                                    y={midY + exH / 2 + 11}
                                    textAnchor="middle"
                                    fontSize={8}
                                    fontWeight={800}
                                    fill={C.cassette}
                                    letterSpacing={0.5}
                                >
                                    SKIPPED
                                </text>
                            )}
                        </g>
                    );
                })}
            </g>
        );
    }

    renderPsiAnnotations(base: number) {
        const labels = this.psiLabels(base);
        return labels.map((l, i) => {
            const color =
                l.psi >= 0.8
                    ? C.psiIncluded
                    : l.psi <= 0.2
                    ? C.psiSkipped
                    : C.psiPartial;
            return (
                <text
                    key={`psi${i}`}
                    x={l.cx}
                    y={l.y}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontWeight={600}
                    fill={color}
                >
                    {l.text}
                </text>
            );
        });
    }

    renderTranscripts(base: number) {
        const exH = 8;
        return this.relevantTx.map((tx, ti) => {
            const y = base + ti * this.txRowH;
            const midY = y + this.txRowH / 2;
            const exons = [...tx.exons].sort((a, b) => a.start - b.start);
            const isMane = tx.isMane;
            return (
                <g key={`tx${ti}`}>
                    <text
                        x={this.mg.left - 4}
                        y={midY + 3}
                        textAnchor="end"
                        fontSize={8}
                        fill={isMane ? C.mane : C.textLight}
                        fontWeight={isMane ? 700 : 400}
                        fontStyle={
                            tx.biotype === 'nonsense_mediated_decay'
                                ? 'italic'
                                : 'normal'
                        }
                    >
                        {tx.name}
                    </text>
                    {exons.length > 0 && (
                        <line
                            x1={this.x(exons[0].start)}
                            x2={this.x(exons[exons.length - 1].end)}
                            y1={midY}
                            y2={midY}
                            stroke={C.txLine}
                            strokeWidth={0.8}
                        />
                    )}
                    {exons.map((ex, ei) => {
                        const x1 = this.x(ex.start);
                        const w = Math.max(2.5, this.x(ex.end) - x1);
                        const isCE = this.cassetteEvents.some(
                            e =>
                                Math.abs(e.start - ex.start) <= 10 &&
                                Math.abs(e.end - ex.end) <= 10
                        );
                        return (
                            <rect
                                key={`tx${ti}e${ei}`}
                                x={x1}
                                y={midY - exH / 2}
                                width={w}
                                height={exH}
                                fill={isCE ? C.cassette : C.txExon}
                                rx={1}
                                opacity={0.85}
                                onMouseEnter={(e: any) =>
                                    this.showTip(
                                        `${tx.name} · Exon ${
                                            ex.num
                                        }\n${tx.biotype.replace(/_/g, ' ')}${
                                            isMane ? ' [MANE]' : ''
                                        }`,
                                        e.clientX,
                                        e.clientY
                                    )
                                }
                                onMouseLeave={this.hideTip}
                            />
                        );
                    })}
                    {/* Biotype tag at right */}
                    <text
                        x={this.mg.left + this.pw + 4}
                        y={midY + 3}
                        fontSize={7}
                        fill={C.textFaint}
                    >
                        {isMane
                            ? 'MANE'
                            : tx.isCanonical
                            ? 'Canon.'
                            : (BIOTYPE_SHORT as any)[tx.biotype] || ''}
                    </text>
                </g>
            );
        });
    }

    renderAxis(base: number) {
        const [lo, hi] = this.range;
        const span = hi - lo;
        const step = span / 5;
        const mag = Math.pow(10, Math.floor(Math.log10(step)));
        const nice = Math.ceil(step / mag) * mag;
        const ticks: number[] = [];
        for (let t = Math.ceil(lo / nice) * nice; t <= hi; t += nice)
            ticks.push(t);
        return (
            <g>
                <line
                    x1={this.mg.left}
                    x2={this.mg.left + this.pw}
                    y1={base}
                    y2={base}
                    stroke={C.axis}
                    strokeWidth={0.8}
                />
                {ticks.map((t, i) => (
                    <g key={`tk${i}`}>
                        <line
                            x1={this.x(t)}
                            x2={this.x(t)}
                            y1={base}
                            y2={base + 4}
                            stroke={C.axis}
                            strokeWidth={0.8}
                        />
                        <text
                            x={this.x(t)}
                            y={base + 14}
                            textAnchor="middle"
                            fontSize={8}
                            fill={C.textFaint}
                        >
                            {(t / 1e6).toFixed(2)} Mb
                        </text>
                    </g>
                ))}
                <text
                    x={this.mg.left + this.pw / 2}
                    y={base + 26}
                    textAnchor="middle"
                    fontSize={9}
                    fill={C.textLight}
                >
                    Chromosome {this.chr}
                </text>
            </g>
        );
    }

    renderLegend(base: number) {
        const items: Array<{
            color: string;
            label: string;
            shape: 'arc' | 'rect';
        }> = [
            { color: C.arcConst, label: 'Constitutive', shape: 'arc' },
            { color: C.arcSkip, label: 'Exon-skipping', shape: 'arc' },
            { color: C.arcIncl, label: 'Inclusion', shape: 'arc' },
            { color: C.exon, label: 'Exon', shape: 'rect' },
            { color: C.cassette, label: 'Cassette exon', shape: 'rect' },
        ];
        const gap = 20;
        // Calculate total width to center the legend
        const itemWidths = items.map(
            it => (it.shape === 'arc' ? 16 : 12) + 6 + it.label.length * 6
        );
        const totalW = itemWidths.reduce((s, w) => s + w + gap, -gap);
        let xOff = this.mg.left + (this.pw - totalW) / 2;
        return (
            <g>
                {items.map((it, i) => {
                    const x0 = xOff;
                    if (it.shape === 'arc') {
                        xOff += 16 + 6 + it.label.length * 6 + gap;
                        return (
                            <g key={`lg${i}`}>
                                <path
                                    d={`M ${x0},${base} C ${x0},${base -
                                        8} ${x0 + 14},${base - 8} ${x0 +
                                        14},${base}`}
                                    fill="none"
                                    stroke={it.color}
                                    strokeWidth={1.8}
                                />
                                <text
                                    x={x0 + 20}
                                    y={base + 1}
                                    fontSize={9}
                                    fill={C.textLight}
                                >
                                    {it.label}
                                </text>
                            </g>
                        );
                    }
                    xOff += 12 + 6 + it.label.length * 6 + gap;
                    return (
                        <g key={`lg${i}`}>
                            <rect
                                x={x0}
                                y={base - 7}
                                width={12}
                                height={9}
                                fill={it.color}
                                rx={1.5}
                            />
                            <text
                                x={x0 + 16}
                                y={base + 1}
                                fontSize={9}
                                fill={C.textLight}
                            >
                                {it.label}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    }

    renderInferenceTable() {
        if (this.scores.length === 0) return null;
        const hdr = {
            padding: '5px 10px',
            color: C.textLight,
            fontWeight: 600 as const,
            fontSize: 10,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.4,
            textAlign: 'left' as const,
            borderBottom: `2px solid ${C.border}`,
        };
        const td = {
            padding: '5px 10px',
            fontSize: 11,
            borderBottom: `1px solid ${C.grid}`,
        };
        return (
            <div style={{ margin: '8px 16px 16px', fontSize: 12 }}>
                <div
                    style={{
                        fontWeight: 700,
                        color: C.text,
                        marginBottom: 6,
                        fontSize: 13,
                    }}
                >
                    Transcript Inference
                </div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr>
                            {[
                                'Transcript',
                                'Biotype',
                                'Exons',
                                'Score',
                                'Tags',
                                'Evidence',
                            ].map(h => (
                                <th key={h} style={hdr}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {this.scores.slice(0, 6).map((s, i) => (
                            <tr
                                key={i}
                                style={{
                                    background:
                                        i === 0 ? '#F0F7FF' : 'transparent',
                                }}
                            >
                                <td
                                    style={{
                                        ...td,
                                        fontWeight: s.isMane ? 700 : 400,
                                        color: s.isMane ? C.mane : C.text,
                                    }}
                                >
                                    {s.name}
                                </td>
                                <td style={{ ...td, color: C.textMed }}>
                                    {s.biotype.replace(/_/g, ' ')}
                                </td>
                                <td style={{ ...td, color: C.textFaint }}>
                                    {s.nExons}
                                </td>
                                <td
                                    style={{
                                        ...td,
                                        fontWeight: 700,
                                        color:
                                            s.score > 15
                                                ? C.psiIncluded
                                                : s.score > 5
                                                ? C.psiPartial
                                                : C.psiSkipped,
                                    }}
                                >
                                    {s.score.toFixed(1)}
                                </td>
                                <td style={td}>
                                    {s.isMane && (
                                        <span
                                            style={{
                                                background: C.mane,
                                                color: '#fff',
                                                padding: '1px 6px',
                                                borderRadius: 3,
                                                fontSize: 9,
                                                marginRight: 3,
                                            }}
                                        >
                                            MANE
                                        </span>
                                    )}
                                    {s.isCanonical && (
                                        <span
                                            style={{
                                                background: '#7048E8',
                                                color: '#fff',
                                                padding: '1px 6px',
                                                borderRadius: 3,
                                                fontSize: 9,
                                            }}
                                        >
                                            Canon
                                        </span>
                                    )}
                                </td>
                                <td
                                    style={{
                                        ...td,
                                        color: C.textFaint,
                                        fontSize: 10,
                                        maxWidth: 380,
                                    }}
                                >
                                    {s.evidence.slice(0, 3).join('; ')}
                                    {s.evidence.length > 3 &&
                                        ` (+${s.evidence.length - 3})`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    public render() {
        if (this.sorted.length === 0)
            return (
                <div
                    style={{
                        padding: 40,
                        textAlign: 'center',
                        color: C.textFaint,
                    }}
                >
                    No events to display
                </div>
            );

        // Layout: arcs → coverage → gene model → PSI labels → transcripts → axis → legend
        let y = this.mg.top;
        const arcY = y;
        y += this.arcH;
        const covY = y;
        y += this.covH + 2;
        const geneY = y;
        y += this.geneH + 14; // extra space for SKIPPED label
        const psiY = y + 4;
        y += this.psiH + 2;
        const txY = y;
        y += this.txH;
        const axisY = y + 2;
        y += 40;
        const legY = y + 4;
        const totalH = legY + 16;

        return (
            <div
                style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                }}
            >
                {this.renderHeader()}
                <div style={{ position: 'relative' }}>
                    <svg
                        width={this.props.width}
                        height={totalH}
                        style={{
                            display: 'block',
                            fontFamily:
                                "'Inter','Segoe UI',system-ui,sans-serif",
                        }}
                    >
                        {this.renderArcs(arcY)}
                        {this.renderCoverage(covY)}
                        <line
                            x1={this.mg.left}
                            x2={this.mg.left + this.pw}
                            y1={covY + this.covH + 1}
                            y2={covY + this.covH + 1}
                            stroke={C.grid}
                            strokeWidth={0.5}
                        />
                        {this.renderGeneModel(geneY)}
                        {this.renderPsiAnnotations(psiY)}
                        {/* "Transcripts" label */}
                        <text
                            x={this.mg.left - 4}
                            y={txY - 2}
                            fontSize={8}
                            fontWeight={600}
                            fill={C.textFaint}
                            textAnchor="end"
                        >
                            Isoforms
                        </text>
                        {this.renderTranscripts(txY)}
                        {this.renderAxis(axisY)}
                        {this.renderLegend(legY)}
                    </svg>
                    {this.tipShow && (
                        <div
                            style={{
                                position: 'fixed',
                                left: this.tipX + 12,
                                top: this.tipY - 12,
                                background: 'rgba(33,37,41,0.93)',
                                color: '#fff',
                                padding: '6px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                whiteSpace: 'pre-line',
                                pointerEvents: 'none',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                                zIndex: 9999,
                                lineHeight: 1.4,
                                maxWidth: 260,
                            }}
                        >
                            {this.tipText}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
