import { GenomeNexusAPI } from 'cbioportal-frontend-commons';
import AppConfig from 'appConfig';
import { DEFAULT_GENOME_NEXUS_URL_GRCH38 } from 'react-mutation-mapper';

async function checkVersion(client: GenomeNexusAPI) {
    const versionResp = await client.fetchVersionGET({});
    if (parseInt(versionResp.version.split('.')[0]) !== 1) {
        console.error(
            'Expected version of Genome Nexus to be 1.x.y, but found: ' +
                versionResp.version
        );
    }
}

// TODO change to config
const client = new GenomeNexusAPI(DEFAULT_GENOME_NEXUS_URL_GRCH38!);
//checkVersion(client);

export default client;
