'use strict';

/**
 * A currency rate result obtained by the worker which is saved in mongodb
 * @typedef {object} CurrencyRateResult
 *
 * @property {string} from - From currency
 * @property {string} to - To currency
 * @property {Date} created_at - date the result was created
 * @property {string} rate -  the rate result
 *
 */
class CurrencyRateResult {

    /**
     *
     * @param {string} from
     * @param {string} to
     * @param {Date} created_at
     * @param {string} rate
     *
     * @constructor
     */
    constructor(from, to, created_at, rate) {
        this.from = from;
        this.to = to;
        this.created_at = created_at;
        this.rate = rate;
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
     * @returns {Date}
     */
    get createAt(){
        return this.created_at;
    }

    /**
     *
     * @returns {string}
     */
    get exchangeRate(){
        return this.rate;
    }
}

module.exports = CurrencyRateResult;