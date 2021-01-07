import autobind from 'autobind-decorator';
import { MyVariantInfo } from 'genome-nexus-ts-api-client';
import { observer } from 'mobx-react';
import * as React from 'react';

import { defaultSortMethod } from '../../util/ReactTableUtils';
import ClinVarSummary, {
    formatClinicalSignificanceText,
    getRcvCountMap,
    getRcvData,
} from '../clinvar/ClinVarSummary';
import {
    MyVariantInfoProps,
    renderMyVariantInfoContent,
} from './MyVariantInfoHelper';

export function download(myVariantInfo?: MyVariantInfo): string {
    const value = sortValue(myVariantInfo);

    return value ? value.toString() : '';
}

export function sortValue(myVariantInfo?: MyVariantInfo): string | null {
    const rcvData =
        myVariantInfo && myVariantInfo.clinVar
            ? getRcvData(getRcvCountMap(myVariantInfo.clinVar))
            : undefined;

    return rcvData ? formatClinicalSignificanceText(rcvData) : null;
}

export function clinVarSortMethod(a: MyVariantInfo, b: MyVariantInfo) {
    return defaultSortMethod(sortValue(a), sortValue(b));
}

@observer
export default class ClinVar extends React.Component<MyVariantInfoProps, {}> {
    public static defaultProps: Partial<MyVariantInfoProps> = {
        className: 'pull-right mr-1',
    };

    public render() {
        return renderMyVariantInfoContent(this.props, this.getContent);
    }

    @autobind
    public getContent(myVariantInfo: MyVariantInfo) {
        return <ClinVarSummary myVariantInfo={myVariantInfo} />;
    }
}
