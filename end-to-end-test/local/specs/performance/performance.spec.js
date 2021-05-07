const assert = require('chai').assert;
const postEndpointMaxResponseTime = require('../../../shared/specUtils')
    .postEndpointMaxResponseTime;
const goToUrlAndSetLocalStorage = require('../../../shared/specUtils')
    .goToUrlAndSetLocalStorage;
const CBIOPORTAL_URL = process.env.CBIOPORTAL_URL.replace(/\/$/, '');

describe('Endpoints performance tests', () => {
    it('Mutated-genes endpoint should return in 1s', () => {
        goToUrlAndSetLocalStorage(CBIOPORTAL_URL, true);
        // endpoint url
        const URL = CBIOPORTAL_URL + '/api/mutated-genes/fetch';
        // run 5 times
        const RUN_TIMES = 5;
        // default max response time: 1s
        const MAX_TIME = 1000;
        // study: Test study es_0
        const REQUEST_BODY = require('./performance_test_request_body.json');
        assert.isAtMost(
            postEndpointMaxResponseTime(URL, REQUEST_BODY, RUN_TIMES),
            MAX_TIME,
            'all mutated-gene queries should be less than 1s'
        );
    });
});
