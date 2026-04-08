import {
    WhippetPsiEvent,
    SplicingEventType,
    SpliceJunction,
    GtfTranscript,
    GtfExon,
    JunctionArc,
    EventMapping,
    TranscriptScore,
} from './SplicingTypes';

// ─── Parsers ────────────────────────────────────────────────────────────────

export function parseWhippetPsi(tsvContent: string): WhippetPsiEvent[] {
    const lines = tsvContent.trim().split('\n');
    if (lines.length < 2) return [];
    return lines.slice(1).map(line => {
        const [gene, coord, strand, type, psi, totalReads, tpm] = line.split(
            '\t'
        );
        const [chr, positions] = coord.split(':');
        const [start, end] = positions.split('-').map(Number);
        return {
            gene,
            coord,
            chr,
            start,
            end,
            strand: strand as '+' | '-',
            type: type as SplicingEventType,
            psi: parseFloat(psi),
            totalReads: parseFloat(totalReads),
            tpm: parseFloat(tpm),
        };
    });
}

export function parseSJoutTab(tsvContent: string): SpliceJunction[] {
    const lines = tsvContent.trim().split('\n');
    // First line could be header or data
    const startIdx = lines[0].startsWith('chrom') ? 1 : 0;
    return lines.slice(startIdx).map(line => {
        const cols = line.split('\t');
        const uniqueReads = parseInt(cols[6]) || 0;
        const multiReads = parseInt(cols[7]) || 0;
        return {
            chrom: cols[0],
            intronStart: parseInt(cols[1]),
            intronEnd: parseInt(cols[2]),
            strand: parseInt(cols[3]),
            annotated: cols[5] === '1',
            uniqueReads,
            multiReads,
            totalReads: uniqueReads + multiReads,
        };
    });
}

export function getGeneEvents(
    events: WhippetPsiEvent[],
    geneId: string
): WhippetPsiEvent[] {
    return events
        .filter(e => e.gene === geneId)
        .sort((a, b) => a.start - b.start);
}

export function getUniqueGenes(events: WhippetPsiEvent[]): string[] {
    return [...new Set(events.map(e => e.gene))].sort();
}

// ─── Junction Arc Building (from STAR SJ.out.tab + Whippet PSI) ────────────

/**
 * Build junction arcs from SJ.out.tab data, classified using Whippet PSI events.
 *
 * Classification:
 *  - 'skipping': junction that skips over a cassette exon (CE with PSI < 0.8)
 *  - 'inclusion': junction flanking a cassette exon (connecting to/from it)
 *  - 'constitutive': all other annotated junctions
 */
export function buildJunctionArcs(
    junctions: SpliceJunction[],
    events: WhippetPsiEvent[],
    exons: GtfExon[],
    chr: string
): JunctionArc[] {
    // Filter junctions to this gene's chromosome & region
    const geneStart = Math.min(
        ...events.map(e => e.start),
        ...exons.map(e => e.start)
    );
    const geneEnd = Math.max(
        ...events.map(e => e.end),
        ...exons.map(e => e.end)
    );

    const regionJunctions = junctions.filter(
        j =>
            j.chrom === chr &&
            j.intronStart >= geneStart - 500 &&
            j.intronEnd <= geneEnd + 500 &&
            j.totalReads > 0
    );

    // Identify cassette exons (CE events with PSI info)
    const cassetteExons = events.filter(e => e.type === 'CE');

    const arcs: JunctionArc[] = [];

    for (const junc of regionJunctions) {
        // intronStart = last base of upstream exon + 1 (STAR 1-based)
        // intronEnd = first base of downstream exon - 1
        const donor = junc.intronStart - 1; // exon end
        const acceptor = junc.intronEnd + 1; // next exon start

        let junctionType: JunctionArc['junctionType'] = 'constitutive';
        let matchedPsi: number | undefined;
        let matchedEvType: SplicingEventType | undefined;

        // FIRST pass: check if this junction SKIPS any cassette exon (highest priority)
        for (const ce of cassetteExons) {
            if (donor < ce.start - 10 && acceptor > ce.end + 10) {
                junctionType = 'skipping';
                matchedPsi = ce.psi;
                matchedEvType = ce.type;
                break;
            }
        }

        // SECOND pass: if not skipping, check if it's an inclusion junction
        if (junctionType === 'constitutive') {
            for (const ce of cassetteExons) {
                if (
                    Math.abs(acceptor - ce.start) <= 5 ||
                    Math.abs(donor - ce.end) <= 5
                ) {
                    junctionType = 'inclusion';
                    matchedPsi = ce.psi;
                    matchedEvType = ce.type;
                    break;
                }
            }
        }

        arcs.push({
            fromEnd: donor,
            toStart: acceptor,
            reads: junc.totalReads,
            junctionType,
            psi: matchedPsi,
            eventType: matchedEvType,
        });
    }

    return arcs.sort((a, b) => a.fromEnd - b.fromEnd);
}

/**
 * Fallback: build arcs purely from Whippet PSI when no SJ.out.tab is available.
 */
export function buildArcsFromPsi(events: WhippetPsiEvent[]): JunctionArc[] {
    const arcs: JunctionArc[] = [];
    const arcTypes: SplicingEventType[] = ['CE', 'RI', 'TE', 'AF', 'AL'];
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (!arcTypes.includes(ev.type)) continue;
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            if (events[j].end < ev.start) {
                arcs.push({
                    fromEnd: events[j].end,
                    toStart: ev.start,
                    reads: ev.totalReads,
                    junctionType: ev.psi < 0.5 ? 'skipping' : 'constitutive',
                    psi: ev.psi,
                    eventType: ev.type,
                });
                break;
            }
        }
        for (let j = i + 1; j < Math.min(events.length, i + 4); j++) {
            if (events[j].start > ev.end) {
                arcs.push({
                    fromEnd: ev.end,
                    toStart: events[j].start,
                    reads: ev.totalReads,
                    junctionType: ev.psi < 0.5 ? 'skipping' : 'constitutive',
                    psi: ev.psi,
                    eventType: ev.type,
                });
                break;
            }
        }
    }
    return arcs;
}

// ─── Exon/Transcript Mapping ────────────────────────────────────────────────

export function mapEventsToExons(
    events: WhippetPsiEvent[],
    transcripts: GtfTranscript[]
): EventMapping[] {
    return events.map(ev => {
        const matches = transcripts.flatMap(t =>
            t.exons
                .map(e => {
                    const overlap = Math.max(
                        0,
                        Math.min(ev.end, e.end) -
                            Math.max(ev.start, e.start) +
                            1
                    );
                    if (overlap <= 0) return null;
                    const evLen = ev.end - ev.start + 1;
                    return {
                        transcriptId: t.id,
                        transcriptName: t.name,
                        exonNum: e.num,
                        exonStart: e.start,
                        exonEnd: e.end,
                        overlapBp: overlap,
                        overlapPct: (overlap / evLen) * 100,
                        exactMatch: ev.start === e.start && ev.end === e.end,
                    };
                })
                .filter((m): m is NonNullable<typeof m> => m !== null)
        );
        return {
            coord: ev.coord,
            type: ev.type,
            psi: ev.psi,
            reads: ev.totalReads,
            start: ev.start,
            end: ev.end,
            matches,
        };
    });
}

export function inferTranscripts(
    mappings: EventMapping[],
    transcripts: GtfTranscript[]
): TranscriptScore[] {
    const scores = transcripts.map(t => {
        let score = 0;
        const evidence: string[] = [];
        for (const m of mappings) {
            const exact = m.matches.filter(
                x => x.transcriptId === t.id && x.exactMatch
            );
            if (exact.length > 0) {
                const en = exact[0].exonNum;
                if (m.psi >= 0.8) {
                    score += 2;
                    evidence.push(
                        `Exon ${en} included (PSI=${m.psi.toFixed(2)}) ✓`
                    );
                } else if (m.psi <= 0.2) {
                    score -= 1;
                    evidence.push(
                        `Exon ${en} skipped (PSI=${m.psi.toFixed(2)}) ✗`
                    );
                } else {
                    score += 0.5;
                    evidence.push(
                        `Exon ${en} partial (PSI=${m.psi.toFixed(2)}) ~`
                    );
                }
            }
        }
        return {
            id: t.id,
            name: t.name,
            score,
            nExons: t.exons.length,
            isMane: t.isMane,
            isCanonical: t.isCanonical,
            biotype: t.biotype,
            evidence,
        };
    });
    return scores.sort((a, b) => b.score - a.score);
}

// ─── Coordinate Formatting ──────────────────────────────────────────────────

export function formatPosition(pos: number, geneSpan: number): string {
    if (geneSpan > 100_000) return `${(pos / 1e6).toFixed(3)} Mb`;
    if (geneSpan > 10_000) return `${(pos / 1e3).toFixed(1)} Kb`;
    if (geneSpan > 1_000) return `${(pos / 1e3).toFixed(2)} Kb`;
    return pos.toLocaleString();
}

export function calculateTicks(
    start: number,
    end: number,
    n: number = 8
): number[] {
    const span = end - start;
    const raw = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    let step = mag;
    for (const ns of [1, 2, 5, 10]) {
        if (ns * mag >= raw) {
            step = ns * mag;
            break;
        }
    }
    step = Math.max(step, 1);
    const ticks: number[] = [];
    for (let p = Math.ceil(start / step) * step; p <= end; p += step) {
        if (p >= start) ticks.push(p);
    }
    return ticks;
}

export function findInterestingGenes(events: WhippetPsiEvent[], topN = 30) {
    const map = new Map<
        string,
        { events: WhippetPsiEvent[]; types: Set<string> }
    >();
    for (const e of events) {
        if (!map.has(e.gene)) map.set(e.gene, { events: [], types: new Set() });
        const g = map.get(e.gene)!;
        g.events.push(e);
        g.types.add(e.type);
    }
    return Array.from(map.entries())
        .map(([gene, d]) => {
            const psis = d.events.map(e => e.psi);
            const mean = psis.reduce((a, b) => a + b, 0) / psis.length;
            const variance =
                psis.reduce((a, b) => a + (b - mean) ** 2, 0) / psis.length;
            const meanReads =
                d.events.reduce((a, b) => a + b.totalReads, 0) /
                d.events.length;
            return {
                gene,
                nEvents: d.events.length,
                nTypes: d.types.size,
                psiVariance: variance,
                meanReads,
            };
        })
        .filter(g => g.nEvents >= 8 && g.nTypes >= 3 && g.meanReads > 20)
        .sort((a, b) => b.psiVariance - a.psiVariance)
        .slice(0, topN);
}
