import * as React from 'react';
import { Circle } from 'better-react-spinkit';
import classNames from 'classnames';
import {
    DefaultTooltip,
    TableCellStatusIndicator,
    TableCellStatus,
} from 'cbioportal-frontend-commons';
import {
    MutationAssessor as MutationAssessorData,
    VariantAnnotation,
} from 'genome-nexus-ts-api-client';
import 'rc-tooltip/assets/bootstrap_white.css';
import { Mutation, DiscreteCopyNumberData } from 'cbioportal-ts-api-client';
import MutationAssessor from 'shared/components/annotation/genomeNexus/MutationAssessor';
import Sift from 'shared/components/annotation/genomeNexus/Sift';
import PolyPhen2 from 'shared/components/annotation/genomeNexus/PolyPhen2';
import siftStyles from 'shared/components/annotation/genomeNexus/styles/siftTooltip.module.scss';
import polyPhen2Styles from 'shared/components/annotation/genomeNexus/styles/polyPhen2Tooltip.module.scss';
import mutationAssessorStyles from 'shared/components/annotation/genomeNexus/styles/mutationAssessorColumn.module.scss';
import annotationStyles from 'shared/components/annotation/styles/annotation.module.scss';
import GenomeNexusMutationAssessorCache from 'shared/cache/GenomeNexusMutationAssessorCache';
import GenomeNexusCache, {
    GenomeNexusCacheDataType,
} from 'shared/cache/GenomeNexusCache';
import _ from 'lodash';
import { shouldShowMutationAssessor } from 'shared/lib/genomeNexusAnnotationSourcesUtils';

type FunctionalImpactColumnTooltipProps = {
    active: 'mutationAssessor' | 'sift' | 'polyPhen2';
};

interface IFunctionalImpactColumnTooltipState {
    active: 'mutationAssessor' | 'sift' | 'polyPhen2';
}

enum FunctionalImpactColumnsName {
    MUTATION_ASSESSOR,
    SIFT,
    POLYPHEN2,
}

interface FunctionalImpactData {
    mutationAssessor: MutationAssessorData | undefined;
    siftScore: number | undefined;
    siftPrediction: string | undefined;
    polyPhenScore: number | undefined;
    polyPhenPrediction: string | undefined;
}

class FunctionalImpactColumnTooltip extends React.Component<
    FunctionalImpactColumnTooltipProps,
    IFunctionalImpactColumnTooltipState
> {
    constructor(props: FunctionalImpactColumnTooltipProps) {
        super(props);
        this.state = {
            active: this.props.active,
        };
    }

    legend() {
        const showMutationAssessor = shouldShowMutationAssessor();
        return (
            <div>
                <table className="table table-striped table-border-top">
                    <thead>
                        <tr>
                            <th>Legend</th>
                            {showMutationAssessor && (
                                <th>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 22,
                                        }}
                                        title="Mutation Asessor"
                                        onMouseOver={() =>
                                            this.setState({
                                                active: 'mutationAssessor',
                                            })
                                        }
                                    >
                                        <img
                                            height={14}
                                            width={14}
                                            src={require('./mutationAssessor.png')}
                                            alt="Mutation Assessor"
                                        />
                                    </span>
                                </th>
                            )}
                            <th>
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: 22,
                                    }}
                                    title="SIFT"
                                    onMouseOver={() =>
                                        this.setState({ active: 'sift' })
                                    }
                                >
                                    <img
                                        height={14}
                                        width={14}
                                        src={require('./siftFunnel.png')}
                                        alt="SIFT"
                                    />
                                </span>
                            </th>
                            <th>
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: 22,
                                    }}
                                    title="PolyPhen-2"
                                    onMouseOver={() =>
                                        this.setState({ active: 'polyPhen2' })
                                    }
                                >
                                    <img
                                        height={14}
                                        width={14}
                                        src={require('./polyPhen-2.png')}
                                        alt="PolyPhen-2"
                                    />
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <span
                                    className={classNames(
                                        annotationStyles[
                                            'annotation-item-text'
                                        ],
                                        mutationAssessorStyles[`ma-high`]
                                    )}
                                >
                                    <i
                                        className="fa fa-circle"
                                        aria-hidden="true"
                                    ></i>
                                </span>
                            </td>
                            {showMutationAssessor && (
                                <td
                                    className={
                                        mutationAssessorStyles['ma-high']
                                    }
                                >
                                    high
                                </td>
                            )}
                            <td className={siftStyles['sift-deleterious']}>
                                deleterious
                            </td>
                            <td
                                className={
                                    polyPhen2Styles[
                                        'polyPhen2-probably_damaging'
                                    ]
                                }
                            >
                                probably_damaging
                            </td>
                        </tr>
                        {showMutationAssessor && (
                            <tr>
                                <td>
                                    <span
                                        className={classNames(
                                            annotationStyles[
                                                'annotation-item-text'
                                            ],
                                            mutationAssessorStyles[`ma-medium`]
                                        )}
                                    >
                                        <i
                                            className="fa fa-circle"
                                            aria-hidden="true"
                                        ></i>
                                    </span>
                                </td>
                                <td
                                    className={
                                        mutationAssessorStyles['ma-medium']
                                    }
                                >
                                    medium
                                </td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                        )}
                        <tr>
                            <td>
                                <span
                                    className={classNames(
                                        annotationStyles[
                                            'annotation-item-text'
                                        ],
                                        mutationAssessorStyles[`ma-low`]
                                    )}
                                >
                                    <i
                                        className="fa fa-circle"
                                        aria-hidden="true"
                                    ></i>
                                </span>
                            </td>
                            {showMutationAssessor && (
                                <td
                                    className={mutationAssessorStyles['ma-low']}
                                >
                                    low
                                </td>
                            )}
                            <td
                                className={
                                    siftStyles[
                                        'sift-deleterious_low_confidence'
                                    ]
                                }
                            >
                                deleterious_low_confidence
                            </td>
                            <td
                                className={
                                    polyPhen2Styles[
                                        'polyPhen2-possibly_damaging'
                                    ]
                                }
                            >
                                possibly_damaging
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <span
                                    className={classNames(
                                        annotationStyles[
                                            'annotation-item-text'
                                        ],
                                        mutationAssessorStyles[`ma-neutral`]
                                    )}
                                >
                                    <i
                                        className="fa fa-circle"
                                        aria-hidden="true"
                                    ></i>
                                </span>
                            </td>
                            {showMutationAssessor && (
                                <td
                                    className={
                                        mutationAssessorStyles['ma-neutral']
                                    }
                                >
                                    neutral
                                </td>
                            )}
                            <td
                                className={
                                    siftStyles['sift-tolerated_low_confidence']
                                }
                            >
                                tolerated_low_confidence
                            </td>
                            <td className={polyPhen2Styles['polyPhen2-benign']}>
                                benign
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <span
                                    className={classNames(
                                        annotationStyles[
                                            'annotation-item-text'
                                        ],
                                        mutationAssessorStyles[`ma-neutral`]
                                    )}
                                >
                                    <i
                                        className="fa fa-circle"
                                        aria-hidden="true"
                                    ></i>
                                </span>
                            </td>
                            {showMutationAssessor && <td>-</td>}
                            <td className={siftStyles['sift-tolerated']}>
                                tolerated
                            </td>
                            <td>-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }

    public static mutationAssessorText() {
        return (
            <div style={{ width: 450, height: 130 }}>
                Mutation Assessor predicts the functional impact of amino-acid
                substitutions in proteins, such as mutations discovered in
                cancer or missense polymorphisms. The functional impact is
                assessed based on evolutionary conservation of the affected
                amino acid in protein homologs. The method has been validated on
                a large set of disease associated and polymorphic variants (
                <a href="https://www.ncbi.nlm.nih.gov/clinvar/" target="_blank">
                    ClinVar
                </a>
                ).
                <br />
                <b>
                    Mutation Assessor V4 data is available in the portal since
                    Oct. 8, 2024.
                </b>{' '}
                New manuscript is in progress. Click{` `}
                <a href="http://mutationassessor.org/r3/" target="_blank">
                    here
                </a>
                {` `} to see information about V3 data.
            </div>
        );
    }

    public static siftText() {
        return (
            <div style={{ width: 450, height: 100 }}>
                <a href={Sift.SIFT_URL} target="_blank">
                    SIFT
                </a>{' '}
                predicts whether an amino acid substitution affects protein
                function based on sequence homology and the physical properties
                of amino acids. SIFT can be applied to naturally occurring
                nonsynonymous polymorphisms and laboratory-induced missense
                mutations.
            </div>
        );
    }

    public static polyPhen2Text() {
        return (
            <div style={{ width: 450, height: 100 }}>
                <a href={PolyPhen2.POLYPHEN2_URL} target="_blank">
                    PolyPhen-2
                </a>{' '}
                (Polymorphism Phenotyping v2) is a tool which predicts possible
                impact of an amino acid substitution on the structure and
                function of a human protein using straightforward physical and
                comparative considerations.
            </div>
        );
    }

    public render() {
        return (
            <div>
                {this.state.active === 'mutationAssessor' &&
                    FunctionalImpactColumnTooltip.mutationAssessorText()}
                {this.state.active === 'sift' &&
                    FunctionalImpactColumnTooltip.siftText()}
                {this.state.active === 'polyPhen2' &&
                    FunctionalImpactColumnTooltip.polyPhen2Text()}
                {this.legend()}
            </div>
        );
    }
}

export function placeArrow(tooltipEl: any) {
    const arrowEl = tooltipEl.querySelector('.rc-tooltip-arrow');
    arrowEl.style.left = '10px';
}

export default class FunctionalImpactColumnFormatter {
    public static headerRender(name: string) {
        const arrowContent = <div className="rc-tooltip-arrow-inner" />;
        const showMutationAssessor = shouldShowMutationAssessor();
        return (
            <div>
                {name}
                <br />
                <div style={{ height: 14 }}>
                    {showMutationAssessor && (
                        <DefaultTooltip
                            overlay={
                                <FunctionalImpactColumnTooltip active="mutationAssessor" />
                            }
                            placement="topLeft"
                            trigger={['hover', 'focus']}
                            arrowContent={arrowContent}
                            destroyTooltipOnHide={true}
                            onPopupAlign={placeArrow}
                        >
                            <span
                                style={{ display: 'inline-block', width: 22 }}
                            >
                                <img
                                    height={14}
                                    width={14}
                                    src={require('./mutationAssessor.png')}
                                    alt="Sift"
                                />
                            </span>
                        </DefaultTooltip>
                    )}
                    <DefaultTooltip
                        overlay={
                            <FunctionalImpactColumnTooltip active="sift" />
                        }
                        placement="topLeft"
                        trigger={['hover', 'focus']}
                        arrowContent={arrowContent}
                        destroyTooltipOnHide={true}
                        onPopupAlign={placeArrow}
                    >
                        <span style={{ display: 'inline-block', width: 22 }}>
                            <img
                                height={14}
                                width={14}
                                src={require('./siftFunnel.png')}
                                alt="SIFT"
                            />
                        </span>
                    </DefaultTooltip>
                    <DefaultTooltip
                        overlay={
                            <FunctionalImpactColumnTooltip active="polyPhen2" />
                        }
                        placement="topLeft"
                        trigger={['hover', 'focus']}
                        arrowContent={arrowContent}
                        destroyTooltipOnHide={true}
                        onPopupAlign={placeArrow}
                    >
                        <span style={{ display: 'inline-block', width: 22 }}>
                            <img
                                height={14}
                                width={14}
                                src={require('./polyPhen-2.png')}
                                alt="PolyPhen-2"
                            />
                        </span>
                    </DefaultTooltip>
                </div>
            </div>
        );
    }

    public static getData(
        data: Mutation[],
        siftPolyphenCache: GenomeNexusCache,
        mutationAssessorCache: GenomeNexusMutationAssessorCache,
        selectedTranscriptId?: string
    ): FunctionalImpactData {
        const siftPolyphenCacheData = FunctionalImpactColumnFormatter.getDataFromCache(
            data,
            siftPolyphenCache
        );
        const mutationAssessorCacheData = shouldShowMutationAssessor()
            ? FunctionalImpactColumnFormatter.getDataFromCache(
                  data,
                  mutationAssessorCache
              )
            : null;

        const siftData = siftPolyphenCacheData
            ? this.getSiftData(siftPolyphenCacheData.data, selectedTranscriptId)
            : undefined;
        const polyphenData = siftPolyphenCacheData
            ? this.getPolyphenData(
                  siftPolyphenCacheData.data,
                  selectedTranscriptId
              )
            : undefined;
        const mutationAssessor = mutationAssessorCacheData
            ? this.getMutationAssessorData(mutationAssessorCacheData.data)
            : undefined;

        const siftScore = siftData && siftData.siftScore;
        const siftPrediction = siftData && siftData.siftPrediction;
        const polyPhenScore = polyphenData && polyphenData.polyPhenScore;
        const polyPhenPrediction =
            polyphenData && polyphenData.polyPhenPrediction;

        const functionalImpactData: FunctionalImpactData = {
            mutationAssessor,
            siftScore,
            siftPrediction,
            polyPhenScore,
            polyPhenPrediction,
        };
        return functionalImpactData;
    }

    public static getSiftData(
        siftDataCache: VariantAnnotation | null,
        selectedTranscriptId?: string
    ) {
        let siftScore: number | undefined = undefined;
        let siftPrediction: string | undefined = undefined;
        if (siftDataCache && selectedTranscriptId) {
            // find transcript consequence that matches the selected transcript
            const transcriptConsequence = siftDataCache.transcript_consequences.find(
                tc => tc.transcript_id === selectedTranscriptId
            );
            if (transcriptConsequence) {
                siftScore = transcriptConsequence.sift_score;
                siftPrediction = transcriptConsequence.sift_prediction;
            }
        }

        return {
            siftScore,
            siftPrediction,
        };
    }

    public static getPolyphenData(
        polyphenDataCache: VariantAnnotation | null,
        selectedTranscriptId?: string
    ) {
        let polyPhenScore: number | undefined = undefined;
        let polyPhenPrediction: string | undefined = undefined;

        if (polyphenDataCache && selectedTranscriptId) {
            // find transcript consequence that matches the selected transcript
            const transcriptConsequence = polyphenDataCache.transcript_consequences.find(
                tc => tc.transcript_id === selectedTranscriptId
            );
            if (transcriptConsequence) {
                polyPhenScore = transcriptConsequence.polyphen_score;
                polyPhenPrediction = transcriptConsequence.polyphen_prediction;
            }
        }

        return {
            polyPhenScore,
            polyPhenPrediction,
        };
    }

    public static getMutationAssessorData(
        mutationAssessorDataCache: VariantAnnotation | null
    ): MutationAssessorData | undefined {
        return mutationAssessorDataCache?.mutation_assessor;
    }

    public static renderFunction(
        data: Mutation[],
        siftPolyphenCache: GenomeNexusCache | undefined,
        mutationAssessorCache: GenomeNexusMutationAssessorCache | undefined,
        selectedTranscriptId?: string
    ) {
        const showMutationAssessor = shouldShowMutationAssessor();

        const siftPolyphenCacheData = FunctionalImpactColumnFormatter.getDataFromCache(
            data,
            siftPolyphenCache
        );
        const mutationAssessorCacheData = showMutationAssessor
            ? FunctionalImpactColumnFormatter.getDataFromCache(
                  data,
                  mutationAssessorCache
              )
            : null;
        return (
            <div>
                {showMutationAssessor &&
                    FunctionalImpactColumnFormatter.makeFunctionalImpactViz(
                        mutationAssessorCacheData,
                        FunctionalImpactColumnsName.MUTATION_ASSESSOR
                    )}
                {FunctionalImpactColumnFormatter.makeFunctionalImpactViz(
                    siftPolyphenCacheData,
                    FunctionalImpactColumnsName.SIFT,
                    selectedTranscriptId
                )}
                {FunctionalImpactColumnFormatter.makeFunctionalImpactViz(
                    siftPolyphenCacheData,
                    FunctionalImpactColumnsName.POLYPHEN2,
                    selectedTranscriptId
                )}
            </div>
        );
    }

    public static download(
        data: Mutation[],
        siftPolyphenCache: GenomeNexusCache,
        mutationAssessorCache: GenomeNexusMutationAssessorCache,
        selectedTranscriptId?: string
    ): string {
        if (siftPolyphenCache || mutationAssessorCache) {
            const functionalImpactData = FunctionalImpactColumnFormatter.getData(
                data,
                siftPolyphenCache,
                mutationAssessorCache,
                selectedTranscriptId
            );
            let downloadData = [];
            if (functionalImpactData) {
                if (shouldShowMutationAssessor()) {
                    downloadData.push(
                        `MutationAssessor: ${MutationAssessor.download(
                            functionalImpactData.mutationAssessor
                        )}`
                    );
                }
                downloadData = downloadData.concat([
                    `SIFT: ${Sift.download(
                        functionalImpactData.siftScore,
                        functionalImpactData.siftPrediction
                    )}`,
                    `Polyphen-2: ${PolyPhen2.download(
                        functionalImpactData.polyPhenScore,
                        functionalImpactData.polyPhenPrediction
                    )}`,
                ]);
                return downloadData.join(';');
            }
        }
        return '';
    }

    private static getDataFromCache(
        data: Mutation[],
        cache: GenomeNexusCache | GenomeNexusMutationAssessorCache | undefined
    ): GenomeNexusCacheDataType | null {
        if (data.length === 0 || !cache) {
            return null;
        }
        return cache.get(data[0]);
    }

    private static makeFunctionalImpactViz(
        cacheData: GenomeNexusCacheDataType | null,
        column: FunctionalImpactColumnsName,
        selectedTranscriptId?: string
    ) {
        let status: TableCellStatus | null = null;

        if (cacheData === null) {
            status = TableCellStatus.LOADING;
        } else if (cacheData.status === 'error') {
            status = TableCellStatus.ERROR;
        } else if (cacheData.data === null) {
            status = TableCellStatus.NA;
        } else {
            let functionalImpactData;
            switch (column) {
                case FunctionalImpactColumnsName.MUTATION_ASSESSOR:
                    functionalImpactData = FunctionalImpactColumnFormatter.getMutationAssessorData(
                        cacheData.data
                    );
                    return (
                        <MutationAssessor
                            mutationAssessor={functionalImpactData}
                        />
                    );
                case FunctionalImpactColumnsName.SIFT:
                    functionalImpactData = FunctionalImpactColumnFormatter.getSiftData(
                        cacheData.data,
                        selectedTranscriptId
                    );
                    return (
                        <Sift
                            siftScore={functionalImpactData.siftScore}
                            siftPrediction={functionalImpactData.siftPrediction}
                        />
                    );
                case FunctionalImpactColumnsName.POLYPHEN2:
                    functionalImpactData = FunctionalImpactColumnFormatter.getPolyphenData(
                        cacheData.data,
                        selectedTranscriptId
                    );
                    return (
                        <PolyPhen2
                            polyPhenScore={functionalImpactData.polyPhenScore}
                            polyPhenPrediction={
                                functionalImpactData.polyPhenPrediction
                            }
                        />
                    );
            }
        }

        if (status !== null) {
            // show loading circle
            if (status === TableCellStatus.LOADING) {
                return (
                    <Circle
                        size={22}
                        scaleEnd={0.5}
                        scaleStart={0.2}
                        color="#aaa"
                        className="pull-left"
                    />
                );
            } else {
                return <TableCellStatusIndicator status={status} />;
            }
        }
    }
}
