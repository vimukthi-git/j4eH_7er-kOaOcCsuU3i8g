'use strict';

/**
 * A currency rate request to be processed by the worker
 * @typedef {object} CurrencyRateRequest
 *
 * @property {string} from - From currency
 * @property {string} to - To currency
 * @property {number} success_count - number of times the job was successfuk
 * @property {number} last_success_at - timestamp for last successful CurrencyRateRequest processing
 * @property {number} fail_count -  number of times the job failed
 * @property {number} last_fail_at - timestamp for last failed CurrencyRateRequest processing
 * @property {number} job_id - returned from the beanstalk. storing for debugging
 *
 */
class CurrencyRateRequest {

    /**
     *
     * @param {string} from
     * @param {string} to
     * @param {number} success_count
     * @param {number} last_success_at timestamp for last successful CurrencyRateRequest processing
     * @param {number} fail_count
     * @param {number} last_fail_at timestamp for last failed CurrencyRateRequest processing
     *
     * @constructor
     */
    constructor(from, to, success_count, last_success_at, fail_count, last_fail_at) {
        this.from = from;
        this.to = to;
        this.success_count = success_count || 0;
        this.last_success_at = last_success_at || 0;
        this.fail_count = fail_count || 0;
        this.last_fail_at = last_fail_at || -1;
        this.job_id = -1; // jobid returned from the beanstalk for debugging
    }

    /**
     *
     * @returns {string}
     */
    get fromCurrency(){
       return this.from;
    }

    /**
     *
     * @returns {string}
     */
    get toCurrency(){
        return this.to;
    }

    /**
     *
     * @returns {number}
     */
    get successCount(){
        return this.success_count;
    }

    /**
     *
     * @param {number} success_count
     */
    set successCount(success_count){
        this.success_count = success_count;
    }

    /**
     *
     * @returns {number}
     */
    get lastSuccessAt(){
        return this.last_success_at;
    }

    /**
     *
     * @param {number} last_success_at
     */
    set lastSuccessAt(last_success_at){
        this.last_success_at = last_success_at;
    }

    /**
     *
     * @returns {number}
     */
    get failCount(){
        return this.fail_count;
    }

    /**
     *
     * @param {number} fail_count
     */
    set failCount(fail_count){
        this.fail_count = fail_count;
    }

    /**
     *
     * @returns {number}
     */
    get lastFailAt(){
        return this.last_fail_at;
    }

    /**
     *
     * @param {number} last_fail_at
     */
    set lastFailAt(last_fail_at){
        this.last_fail_at = last_fail_at;
    }

}

module.exports = CurrencyRateRequest;