import * as React from 'react';
import { observer } from 'mobx-react';
import { MSKTabs, MSKTab } from 'shared/components/MSKTabs/MSKTabs';
import { ResultsViewPageStore } from '../ResultsViewPageStore';
import ResultsViewMutationMapper from './ResultsViewMutationMapper';
import { convertToMutationMapperProps } from 'shared/components/mutationMapper/MutationMapperConfig';
import MutationMapperUserSelectionStore from 'shared/components/mutationMapper/MutationMapperUserSelectionStore';
import { observable, computed } from 'mobx';
import AppConfig from 'appConfig';
import OqlStatusBanner from '../../../shared/components/banners/OqlStatusBanner';
import autobind from 'autobind-decorator';
import { AppStore } from '../../../AppStore';

import './mutations.scss';
import AlterationFilterWarning from '../../../shared/components/banners/AlterationFilterWarning';
import { getOncoKbApiUrl } from 'shared/api/urls';
import { Mutation } from 'cbioportal-ts-api-client';

export interface IMutationsPageProps {
    routing?: any;
    store: ResultsViewPageStore;
    appStore: AppStore;
}

@observer
export default class Mutations extends React.Component<
    IMutationsPageProps,
    {}
> {
    private userSelectionStore: MutationMapperUserSelectionStore;

    @observable mutationsGeneTab: string;

    constructor(props: IMutationsPageProps) {
        super(props);
        this.handleTabChange.bind(this);
        this.mutationsGeneTab = this.props.store.hugoGeneSymbols![0];
        this.userSelectionStore = new MutationMapperUserSelectionStore();
    }

    @autobind
    private onToggleOql() {
        this.props.store.mutationsTabFilteringSettings.useOql = !this.props
            .store.mutationsTabFilteringSettings.useOql;
    }

    @autobind
    private onToggleVUS() {
        this.props.store.mutationsTabFilteringSettings.excludeVus = !this.props
            .store.mutationsTabFilteringSettings.excludeVus;
    }

    @autobind
    private onToggleGermline() {
        this.props.store.mutationsTabFilteringSettings.excludeGermline = !this
            .props.store.mutationsTabFilteringSettings.excludeGermline;
    }

    public render() {
        const activeTabId = this.props.store.selectedGeneSymbol
            ? this.props.store.selectedGeneSymbol
            : this.mutationsGeneTab;

        return (
            <div data-test="mutationsTabDiv">
                {this.props.store.mutationsByGene.isComplete && (
                    <MSKTabs
                        id="mutationsPageTabs"
                        activeTabId={activeTabId}
                        onTabClick={(id: string) => this.handleTabChange(id)}
                        className="pillTabs resultsPageMutationsGeneTabs"
                        arrowStyle={{ 'line-height': 0.8 }}
                        tabButtonStyle="pills"
                        unmountOnHide={true}
                    >
                        {this.generateTabs(
                            this.props.store.hugoGeneSymbols,
                            this.props.store.mutationsByGene.result
                        )}
                    </MSKTabs>
                )}
            </div>
        );
    }

    protected generateTabs(
        genes: string[],
        mutationsByGene: {
            [hugoGeneSymbol: string]: Mutation[];
        }
    ) {
        const tabs: JSX.Element[] = [];

        genes.forEach((gene: string) => {
            const mutations = mutationsByGene
                ? mutationsByGene[gene]
                : undefined;

            if (mutations) {
                const tabHasMutations = mutations.length > 0;
                // gray out tab if no mutations
                const anchorStyle = tabHasMutations
                    ? undefined
                    : { color: '#bbb' };

                tabs.push(
                    <MSKTab
                        key={gene}
                        id={gene}
                        linkText={gene}
                        anchorStyle={anchorStyle}
                    >
                        {this.props.store.selectedGeneSymbol === gene &&
                            this.geneTabContent}
                    </MSKTab>
                );
            }
        });

        return tabs;
    }

    protected handleTabChange(id: string) {
        this.props.store.setSelectedGeneSymbol(id);
    }

    @computed get geneTabContent() {
        if (
            this.props.store.selectedGene &&
            this.props.store.mutationMapperStoreForSelectedGene
        ) {
            return (
                <div>
                    <div className={'tabMessageContainer'}>
                        <OqlStatusBanner
                            className="mutations-oql-status-banner"
                            store={this.props.store}
                            tabReflectsOql={
                                this.props.store.mutationsTabFilteringSettings
                                    .useOql
                            }
                            isUnaffected={
                                !this.props.store.queryContainsMutationOql
                            }
                            onToggle={this.onToggleOql}
                        />
                        <AlterationFilterWarning
                            store={this.props.store}
                            mutationsTabModeSettings={{
                                excludeVUS: this.props.store
                                    .mutationsTabFilteringSettings.excludeVus,
                                excludeGermline: this.props.store
                                    .mutationsTabFilteringSettings
                                    .excludeGermline,
                                toggleExcludeVUS: this.onToggleVUS,
                                toggleExcludeGermline: this.onToggleGermline,
                                hugoGeneSymbol: this.props.store.selectedGene
                                    .hugoGeneSymbol,
                            }}
                        />
                    </div>
                    <ResultsViewMutationMapper
                        {...convertToMutationMapperProps({
                            ...AppConfig.serverConfig,
                            // override ensemblLink
                            ensembl_transcript_url: this.props.store
                                .ensemblLink,
                            // only show oncokb and hotspots track if
                            // show_oncokb and show_hotspot is set to true
                            // canonical transcript is selected
                            show_oncokb:
                                AppConfig.serverConfig.show_oncokb === true
                                    ? this.props.store
                                          .mutationMapperStoreForSelectedGene
                                          .isCanonicalTranscript
                                    : AppConfig.serverConfig.show_oncokb,
                            show_hotspot:
                                AppConfig.serverConfig.show_hotspot === true
                                    ? this.props.store
                                          .mutationMapperStoreForSelectedGene
                                          .isCanonicalTranscript
                                    : AppConfig.serverConfig.show_hotspot,
                        })}
                        oncoKbPublicApiUrl={getOncoKbApiUrl()}
                        store={
                            this.props.store.mutationMapperStoreForSelectedGene
                        }
                        trackVisibility={
                            this.userSelectionStore.trackVisibility
                        }
                        discreteCNACache={this.props.store.discreteCNACache}
                        pubMedCache={this.props.store.pubMedCache}
                        cancerTypeCache={this.props.store.cancerTypeCache}
                        mutationCountCache={this.props.store.mutationCountCache}
                        genomeNexusCache={this.props.store.genomeNexusCache}
                        genomeNexusMutationAssessorCache={
                            this.props.store.genomeNexusMutationAssessorCache
                        }
                        pdbHeaderCache={this.props.store.pdbHeaderCache}
                        userEmailAddress={this.props.appStore.userName!}
                        generateGenomeNexusHgvsgUrl={
                            this.props.store.generateGenomeNexusHgvsgUrl
                        }
                        showTranscriptDropDown={
                            AppConfig.serverConfig.show_transcript_dropdown
                        }
                    />
                </div>
            );
        }
        return <div></div>;
    }
}
