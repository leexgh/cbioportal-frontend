// Types for Whippet PSI splicing data and sashimi plot rendering

export type SplicingEventType =
    | 'CE'
    | 'AA'
    | 'AD'
    | 'RI'
    | 'TE'
    | 'TS'
    | 'AF'
    | 'AL'
    | 'BS';

export interface WhippetPsiEvent {
    gene: string;
    coord: string;
    chr: string;
    start: number;
    end: number;
    strand: '+' | '-';
    type: SplicingEventType;
    psi: number;
    totalReads: number;
    tpm: number;
}

/** STAR SJ.out.tab splice junction */
export interface SpliceJunction {
    chrom: string;
    intronStart: number;
    intronEnd: number;
    strand: number; // 0=undefined, 1=+, 2=-
    annotated: boolean;
    uniqueReads: number;
    multiReads: number;
    totalReads: number;
}

export interface GtfTranscript {
    id: string;
    name: string;
    biotype: string;
    start: number;
    end: number;
    strand: '+' | '-';
    isMane: boolean;
    isCanonical: boolean;
    tsl: number;
    exons: GtfExon[];
}

export interface GtfExon {
    start: number;
    end: number;
    num: number;
    id: string;
}

/** A junction arc to render on the sashimi plot */
export interface JunctionArc {
    fromEnd: number; // donor (exon end)
    toStart: number; // acceptor (next exon start)
    reads: number;
    /** 'constitutive' | 'skipping' | 'inclusion' */
    junctionType: 'constitutive' | 'skipping' | 'inclusion';
    psi?: number;
    eventType?: SplicingEventType;
}

export interface ExonEventMapping {
    transcriptId: string;
    transcriptName: string;
    exonNum: number;
    exonStart: number;
    exonEnd: number;
    overlapBp: number;
    overlapPct: number;
    exactMatch: boolean;
}

export interface EventMapping {
    coord: string;
    type: SplicingEventType;
    psi: number;
    reads: number;
    start: number;
    end: number;
    matches: ExonEventMapping[];
}

export interface TranscriptScore {
    id: string;
    name: string;
    score: number;
    nExons: number;
    isMane: boolean;
    isCanonical: boolean;
    biotype: string;
    evidence: string[];
}

// ── Design color palette (matches dark-theme reference) ──

/** Junction arc colors */
export const ARC_COLORS = {
    constitutive: '#5B9BD5', // blue
    skipping: '#D4A545', // gold
    inclusion: '#999999', // gray
};

/** Exon fill colors */
export const EXON_COLORS = {
    normal: '#5DAB8B', // teal-green (read coverage / constitutive)
    cassette: '#E8A838', // orange (cassette exon)
    skipped: '#E8A838', // same orange
};

export const EVENT_LABELS: Record<SplicingEventType, string> = {
    CE: 'Cassette Exon',
    AA: 'Alt Acceptor',
    AD: 'Alt Donor',
    RI: 'Retained Intron',
    TE: 'Tandem Exon',
    TS: 'Tandem SS',
    AF: 'Alt First Exon',
    AL: 'Alt Last Exon',
    BS: 'Back-splice',
};

export const TRANSCRIPT_COLORS = [
    '#5DAB8B',
    '#5B9BD5',
    '#D4A545',
    '#C0776E',
    '#8E7CC3',
    '#6FBACC',
    '#C77DB0',
    '#8D6E63',
    '#78909C',
    '#9E9D24',
];

export const BIOTYPE_SHORT: Record<string, string> = {
    protein_coding: '',
    nonsense_mediated_decay: 'NMD',
    retained_intron: 'RI',
    processed_transcript: 'proc.',
    lncRNA: 'lncRNA',
    non_stop_decay: 'NSD',
};
