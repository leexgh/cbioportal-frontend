import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, computed, action, makeObservable } from 'mobx';
import SashimiPlot from './SashimiPlot';
import { PRECOMPUTED_DATA, GENE_LIST, SAMPLE_ID } from './SplicingData';
import { WhippetPsiEvent, GtfExon } from './SplicingTypes';

interface CassetteInfo {
    eventIdx: number; // index among CE events for this gene
    event: WhippetPsiEvent;
    exonNum: string;
    coord: string;
    len: number;
}

@observer
export default class SplicingTab extends React.Component<{}, {}> {
    @observable selectedGene: string = GENE_LIST[0].id;
    @observable focusIdx: number | undefined = undefined;

    constructor(props: {}) {
        super(props);
        makeObservable(this);
    }

    @computed get geneData() {
        return PRECOMPUTED_DATA[this.selectedGene];
    }

    @computed get cassetteEvents(): CassetteInfo[] {
        const gd = this.geneData;
        if (!gd) return [];
        const ceEvents = gd.events
            .filter(e => e.type === 'CE')
            .sort((a, b) => a.start - b.start);
        // Get canonical transcript exons for numbering
        const canonTx =
            gd.transcripts.find(t => t.isMane) ||
            gd.transcripts.find(t => t.isCanonical) ||
            gd.transcripts[0];
        const exons: GtfExon[] = canonTx
            ? [...canonTx.exons].sort((a, b) => a.start - b.start)
            : [];

        return ceEvents.map((ce, idx) => {
            let exonNum = '?';
            for (const ex of exons) {
                const ol = Math.max(
                    0,
                    Math.min(ce.end, ex.end) - Math.max(ce.start, ex.start) + 1
                );
                if (ol > (ex.end - ex.start + 1) * 0.3) {
                    exonNum = String(ex.num);
                    break;
                }
            }
            return {
                eventIdx: idx,
                event: ce,
                exonNum,
                coord: `chr${
                    ce.chr
                }:${ce.start.toLocaleString()}-${ce.end.toLocaleString()}`,
                len: ce.end - ce.start + 1,
            };
        });
    }

    // Only events with PSI < 0.8 AND mapped to a known exon
    @computed get skippingEvents(): CassetteInfo[] {
        return this.cassetteEvents.filter(
            c => c.event.psi < 0.8 && c.exonNum !== '?'
        );
    }

    @action.bound selectGene(geneId: string) {
        this.selectedGene = geneId;
        this.focusIdx = undefined;
    }

    @action.bound focusEvent(idx: number) {
        this.focusIdx = idx;
    }

    @action.bound clearFocus() {
        this.focusIdx = undefined;
    }

    psiColor(psi: number) {
        if (psi <= 0.2) return '#E03131';
        if (psi <= 0.5) return '#E8590C';
        if (psi < 0.8) return '#D69E2E';
        return '#2F9E44';
    }

    psiLabel(psi: number) {
        if (psi <= 0.2) return 'skipped';
        if (psi <= 0.5) return 'partial skip';
        if (psi < 0.8) return 'partial';
        return 'included';
    }

    public render() {
        const gd = this.geneData;
        const skipping = this.skippingEvents;

        return (
            <div style={{ padding: '10px 0' }}>
                {/* Top bar */}
                <div
                    style={{
                        padding: '12px 18px',
                        background: '#FAFBFC',
                        borderRadius: '8px 8px 0 0',
                        border: '1px solid #DEE2E6',
                        borderBottom: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        flexWrap: 'wrap',
                    }}
                >
                    <span
                        style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: '#212529',
                        }}
                    >
                        🧬 Splicing — {SAMPLE_ID}
                    </span>
                    <div>
                        <label
                            style={{
                                color: '#868E96',
                                fontSize: 12,
                                marginRight: 6,
                            }}
                        >
                            Gene:
                        </label>
                        <select
                            value={this.selectedGene}
                            onChange={e => this.selectGene(e.target.value)}
                            style={{
                                fontSize: 12,
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '1px solid #CED4DA',
                                background: '#fff',
                                color: '#212529',
                            }}
                        >
                            {GENE_LIST.map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.name} — {g.nEvents} events,{' '}
                                    {g.nJunctions} junctions
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Sashimi Plot */}
                {gd && (
                    <SashimiPlot
                        events={gd.events}
                        transcripts={gd.transcripts}
                        junctions={gd.junctions}
                        geneId={gd.geneId}
                        geneName={gd.geneName}
                        sampleId={SAMPLE_ID}
                        focusEventIndex={this.focusIdx}
                        onClearFocus={this.clearFocus}
                    />
                )}
            </div>
        );
    }
}
