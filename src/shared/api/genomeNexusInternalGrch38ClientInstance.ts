import { GenomeNexusAPIInternal } from 'cbioportal-frontend-commons';
import AppConfig from 'appConfig';
import { DEFAULT_GENOME_NEXUS_URL_GRCH38 } from 'react-mutation-mapper';

// TODO change to config
const client = new GenomeNexusAPIInternal(DEFAULT_GENOME_NEXUS_URL_GRCH38);

export default client;
