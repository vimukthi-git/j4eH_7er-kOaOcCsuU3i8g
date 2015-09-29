'use strict';

let format = require('string-template');
let osmosis = require('osmosis');
let fivebeans = require('fivebeans');
let MongoClient = require('mongodb').MongoClient;
let CurrencyRateRequest = require('./model/currency_rate_request');
let CurrencyRateResult = require('./model/currency_rate_result');

const SUCCESS_WAIT_DURATION = 60000; // 60 seconds
const SUCCESSFUL_RETRY_COUNT = 10;
const FAILED_WAIT_DURATION = 3000; // 3 seconds
const FAILED_RETRY_COUNT = 3;
const MONGO_URL = 'mongodb://{url}:{port}/{db}';
const MONGO_COLLECTION_NAME = 'exchange_rates';
const SCRAP_URL = 'http://www.xe.com/currencyconverter/convert/?Amount=1&From={from}&To={to}#converter';
const EXTRACT_CSS_PATH = '#contentL > div:nth-child(1) > div:nth-child(3) > div > span > table > tbody > tr.uccRes > td.rightCol';


/**
 * The currency rate worker
 * @typedef {object} Consumer
 *
 * @property {Logger} logger
 * @property {string} beanstalk_url
 * @property {string} beanstalk_port
 * @property {string} beanstalk_tube
 * @property {string} db_url
 * @property {string} db_port
 * @property {string} db_name
 * @property {number} process_frequency - number of milliseconds the worker will await before attempting to pickup another job
 * @property {number} success_wait_duration
 * @property {number} successful_retry_count
 * @property {number} failed_wait_duration
 * @property {number} failed_retry_count
 * @property {boolean} is_beanstalk_connected
 * @property {FiveBeansClient} beanstalk_connection
 * @property {boolean} is_db_connected
 * @property {Mongos} db_connection
 * @property {boolean} execute - worker will stop work when this flag is false
 *
 */
class Consumer {

    /**
     *
     * @param {Logger} logger
     * @param {string} beanstalk_url
     * @param {string} beanstalk_port
     * @param {string} beanstalk_tube
     * @param {string} db_url
     * @param {string} db_port
     * @param {string} db_name
     * @param {number} process_frequency - number of milliseconds the worker will await before re-attempting to pickup another job
     * @param {number} success_wait_duration
     * @param {number} successful_retry_count
     * @param {number} failed_wait_duration
     * @param {number} failed_retry_count
     *
     * @constructor
     */
    constructor(logger, beanstalk_url, beanstalk_port, beanstalk_tube, db_url, db_port,
                db_name, process_frequency, success_wait_duration, successful_retry_count,
                failed_wait_duration, failed_retry_count){
        this.logger = logger;
        this.beanstalk_url = beanstalk_url || '127.0.0.1';
        this.beanstalk_port = beanstalk_port || '11300';
        this.beanstalk_tube = beanstalk_tube || 'vimukthi-git';
        this.db_url = db_url || '127.0.0.1';
        this.db_port = db_port || '27017';
        this.db_name = db_name || 'exchange_db';
        this.process_frequency = process_frequency || 3000;
        this.is_beanstalk_connected = false;
        this.beanstalk_connection = null;
        this.is_db_connected = false;
        this.db_connection = null;
        this.success_wait_duration = success_wait_duration || SUCCESS_WAIT_DURATION;
        this.successful_retry_count = successful_retry_count || SUCCESSFUL_RETRY_COUNT;
        this.failed_wait_duration = failed_wait_duration || FAILED_WAIT_DURATION;
        this.failed_retry_count = failed_retry_count || FAILED_RETRY_COUNT;
    }

    /**
     * worker start interface method
     * @public
     */
    start(){
        let _this = this;
        // run the main sequence every process_frequency seconds
        _this.logger.info('starting work');
        _this.execute = true;
        _this.run();
    }

    /**
     * main worker run method intended to be called internally      *
     * @private
     */
    run(){
        let _this = this;
        if(_this.execute) {
            setTimeout(function() {
                _this.obtainBeanstalkConnection()
                    .then(_this.queryBeanstalk.bind(_this), _this.beanStalkErrorHandler.bind(_this))
                    .then(_this.validateCurrencyRateRequest.bind(_this), _this.beanStalkErrorHandler.bind(_this))
                    .then(_this.findExchangeRate.bind(_this), _this.validationErrorHandler.bind(_this))
                    .then(_this.processScrappedRate.bind(_this), _this.currencyRateErrorHandler.bind(_this))
                    .then(_this.saveToMongo.bind(_this), _this.currencyRateErrorHandler.bind(_this))
                    .then(_this.successHandler.bind(_this), _this.currencyRateErrorHandler.bind(_this))
                    .then(_this.run.bind(_this), _this.run.bind(_this));
            }, this.process_frequency);
        }
    }

    /**
     * worker stop interface method
     * @public
     */
    stop(){
        this.logger.info('stopping work');
        this.execute = false;
        if(this.is_beanstalk_connected) { this.beanstalk_connection.quit();}
        if(this.is_db_connected) { this.db_connection.close();}
    }

    /**
     * Query beanstalk for new jobs
     * @param {FiveBeansClient} beanstalkConnection
     * @returns {Promise}
     */
    queryBeanstalk(beanstalkConnection){
        let _this = this;
        _this.logger.info('Querying beanstalk');
        return new Promise((resolve, reject) => {
            beanstalkConnection.reserve((err, jobid, payload) => {
                if(err){
                    _this.logger.error('beanstalk query error', err);
                    reject(err);
                } else {
                    try {
                        let jobJson = JSON.parse(payload);
                        let job = new CurrencyRateRequest(
                            jobJson.from, jobJson.to,
                            jobJson.success_count, jobJson.last_success_at,
                            jobJson.fail_count, jobJson.last_fail_at);
                        job.jobId = jobid;
                        beanstalkConnection.destroy(jobid, (err) => {
                            if (err) {
                                _this.logger.error('job delete error', err);
                                reject(err);
                            } else {
                                _this.logger.info('Job retrieved from beanstalk', job);
                                resolve(job);
                            }
                        });
                    } catch(e) {
                        _this.logger.error('job retrieval error', e);
                        reject(e);
                    }
                }
            });
        });
    }

    /**
     * validate a CurrencyRateRequest, check if it can be processed now.
     * If not reject.
     * @param {CurrencyRateRequest} rate_request
     * @returns {Promise}
     */
    validateCurrencyRateRequest(rate_request){
        let _this = this;
        _this.logger.info('Validating job', rate_request);
        return new Promise((resolve, reject) => {
            let last_success_timestamp = rate_request.lastSuccessAt;
            let last_fail_timestamp = rate_request.lastFailAt;
            let time_now = new Date().getTime();
            if(last_success_timestamp > last_fail_timestamp &&
                (time_now - last_success_timestamp) >= _this.success_wait_duration){
                _this.logger.info('previously successful Job valid for processing', rate_request);
                resolve(rate_request);
            } else if (last_success_timestamp < last_fail_timestamp &&
                (time_now - last_fail_timestamp) >= _this.failed_wait_duration){
                _this.logger.info('previously failed Job valid for processing', rate_request);
                resolve(rate_request);
            } else {
                _this.logger.error('job invalid for processing right now', rate_request);
                reject(rate_request);
            }
        });
    }

    /**
     * Find exchange rate from xe.com for given request and scrap it.
     * @param {CurrencyRateRequest} rate_request
     * @returns {Promise}
     */
    findExchangeRate(rate_request){
        let _this = this;
        _this.logger.info('Querying to find exchange rate ', rate_request);
        // osmosis throws errors multiple times when there some error within
        // so beware of promise chaing getting called multiple times for same error
        return new Promise((resolve, reject) => {
            osmosis
                .get(format(SCRAP_URL, {from: rate_request.fromCurrency, to: rate_request.toCurrency}))
                .set({
                    'data': EXTRACT_CSS_PATH
                }).data((data) => {
                    _this.logger.info('successfully found exchange rate ', rate_request);
                    resolve([data.data, rate_request]);
                }).error((e) => {
                    _this.logger.error('could not retrieve exchange rate ', rate_request, e);
                    reject([e, rate_request]);
                });
        });
    }

    /**
     * process the previously scrapped exchange rate using regex.
     * @param {[]} data array containing the extracted rate at index 0 and the original CurrencyRateRequest at index 1.
     * @returns {Promise}
     */
    processScrappedRate(data){
        let _this = this;
        _this.logger.info('Processing scrapped rate ', data);
        return new Promise((resolve, reject) => {
            try {
                let processed_number = data[0].trim().match(/^[0-9]+\.[0-9]+/)[0];
                let parsedRate = parseFloat(processed_number).toFixed(2).toString();
                _this.logger.info('Parsed rate ', parsedRate);
                resolve([parsedRate, data[1]]);
            } catch(e){
                _this.logger.error('could not scrap exchange rate ', data[1], e);
                reject([e, data[1]]);
            }
        });
    }

    /**
     * handle success. add again to queue or ignore depending on the SUCCESSFUL_RETRY_COUNT
     * @param {CurrencyRateRequest} rate_request
     */
    successHandler(rate_request){
        let _this = this;
        _this.logger.info('Successfully handled job ', rate_request);
        let num_success = rate_request.successCount + 1;

        if(num_success < _this.successful_retry_count){
            rate_request.lastSuccessAt = new Date().getTime();
            rate_request.successCount = num_success;
            _this.saveToBeanStalk(rate_request).then((jobid) => {
                _this.logger.info('Reput job ', jobid);
            }, _this.beanStalkErrorHandler.bind(_this));
        }
    }

    /**
     * Save back to beanstalk upon validation error as in can not process now.
     * @param {CurrencyRateRequest} rate_request
     * @returns {Promise}
     */
    validationErrorHandler(rate_request){
        let _this = this;
        _this.logger.info('Validation error handling ', rate_request);
        return new Promise((resolve, reject) => {
            _this.saveToBeanStalk(rate_request).then((jobid) => {
                _this.logger.info('Reput job ', jobid);
                reject(rate_request);
            }).then(null, () => {reject(rate_request);});
        });
    }

    /**
     * handling error during currency rate extraction process.
     * @param {[]} data array containing the error at index 0 and the original CurrencyRateRequest at index 1.
     * @returns {Promise}
     */
    currencyRateErrorHandler(data){
        let _this = this;
        _this.logger.info('currency rate error handling ', data);
        return new Promise((resolve, reject) => {
            let e = data[0];
            let rate_request = data[1];
            if(rate_request instanceof CurrencyRateRequest) {
                let num_failures = rate_request.failCount + 1;
                // we only allow a request to be saved back if it not exceeded the given FAILED_RETRY_COUNT
                if (num_failures < _this.failed_retry_count) {
                    rate_request.lastFailAt = new Date().getTime();
                    rate_request.failCount = num_failures;
                    _this.saveToBeanStalk(rate_request).then((jobid) => {
                        _this.logger.info('Reput job ', jobid);
                        reject(e);
                    }).then(null, () => {
                        reject(rate_request);
                    });
                } else {
                    reject(rate_request);
                }
            } else {
                reject(data);
            }
        });
    }

    /**
     * Handle beanstalk error
     * @param e
     * @returns {Promise}
     */
    beanStalkErrorHandler(e){
        this.logger.info('beanstalk error handling ', e);
        return new Promise((resolve, reject) => {
            reject(e);
        });
    }

    /**
     * save retrieved exchange rate to mongodb.
     * @param {[]} data array containing the rate at index 0 and the original CurrencyRateRequest at index 1.
     * @returns {Promise}
     */
    saveToMongo(data){
        let _this = this;
        _this.logger.info('Saving to mongo ', data);
        let rate = data[0];
        let request = data[1];
        let rateToSave = new CurrencyRateResult(request.fromCurrency, request.toCurrency, new Date(), rate);

        return new Promise((resolve, reject) => {
            _this.obtainMongoConnection().then((db) => {
                let collection = db.collection(MONGO_COLLECTION_NAME);
                collection.insertOne(rateToSave, function(err, r) {
                    if(err){
                        _this.logger.error('could not save to mongo ', request, err);
                        data[0] = err;
                        reject(data);
                    } else {
                        resolve(request);
                    }
                });
            }, (e) => {
                _this.logger.error('could not obtain mongo connection ', request, e);
                data[0] = e;
                reject(data);
            });
        });
    }

    /**
     * Save CurrencyRateRequest back to beanstalk
     * @param {CurrencyRateRequest} rate_request
     * @returns {Promise}
     */
    saveToBeanStalk(rate_request){
        let _this = this;
        _this.logger.info('Saving to beanstalk ', rate_request);
        return new Promise((resolve, reject) => {
            _this.obtainBeanstalkConnection().then((beanstalkConnection) => {
                beanstalkConnection.put(1, 0, 100, JSON.stringify(rate_request), function(err, jobid) {
                    if(err) {
                        _this.logger.error('could not save to beanstalk ', rate_request, err);
                        reject(err);
                    } else {
                        resolve(jobid);
                    }
                });
            }, (e) => {
                _this.logger.error('could not obtain beanstalk connection ', rate_request, e);
                reject(e);
            });
        });
    }

    /**
     * Obtain a beanstalk connection. Handles connection, watching the correct tube,
     * ignoring the default tube and using the correct tube.
     * @returns {Promise}
     */
    obtainBeanstalkConnection(){
        let _this = this;
        return new Promise((resolve, reject) => {
            if(_this.is_beanstalk_connected) {
                resolve(_this.beanstalk_connection);
            } else {
                // this is ugly but no other option because of the api offered by fivebeans
                // and promisification is overkill for these overhead tasks
                _this.beanstalk_connection = new fivebeans.client(_this.beanstalk_url, _this.beanstalk_port);
                _this.beanstalk_connection
                    .on('connect', () => {
                        // watching the correct tube
                        _this.beanstalk_connection.watch(_this.beanstalk_tube, (err, numwatched) => {
                            if(err) {
                                reject(err);
                            } else {
                                // ignoring the default tube
                                _this.beanstalk_connection.ignore('default', (err, numwatched) => {
                                    if(err){
                                        reject(err);
                                    } else {
                                        // using the correct tube
                                        _this.beanstalk_connection.use(_this.beanstalk_tube, (err, tubename) => {
                                            if(err) {
                                                reject(err);
                                            } else {
                                                _this.is_beanstalk_connected = true;
                                                resolve(_this.beanstalk_connection);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    })
                    .on('error', (err) => {
                        _this.logger.error('beanstalk error ', err);
                        reject(err);
                    })
                    .on('close', () => {
                        _this.is_beanstalk_connected = false;
                        _this.beanstalk_connection = null;
                    })
                    .connect();
            }
        });
    }

    /**
     * Obtain the mongodb connection
     * @returns {Promise}
     */
    obtainMongoConnection(){
        let _this = this;
        return new Promise((resolve, reject) => {
            if(_this.is_db_connected) {
                resolve(_this.db_connection);
            } else {
                MongoClient.connect(format(MONGO_URL, {
                    url: _this.db_url, port: _this.db_port, db: _this.db_name
                }), (err, db) => {
                    if(err){
                        reject(err);
                    } else {
                        db.on('close', () => {
                            _this.is_db_connected = false;
                            _this.db_connection = null;
                        });
                        _this.is_db_connected = true;
                        _this.db_connection = db;
                        resolve(_this.db_connection);
                    }
                });
            }
        });
    }

}

module.exports = Consumer;



