'use strict';

let assert = require('assert');

let Consumer = require('../src/consumer');
var CurrencyRateRequest = require('../src/model/currency_rate_request');
let bunyan = require('bunyan');
let format = require('string-template');
let exec = require('child_process').exec;

let log = bunyan.createLogger({
    name        : 'Testing ExchangeWorker',
    level       : process.env.LOG_LEVEL || 'debug',
    stream      : process.stdout,
    serializers : bunyan.stdSerializers
});

let current_dir = __dirname;
let produce_command = 'node ' + current_dir + '/../bin/producer.js -n {njobs} -h {host} -p {port} -t {tube}';

let test_config = {
    "beanstalk" :{
        "host": "127.0.0.1",
        "port" : "11300",
        "tube": "test_tube"
    },

    "mongodb" :{
        "host"     : "127.0.0.1",
        "port"     : "27017",
        "database" : "test_db"
    }
};



// unit tests for Consumer class
describe('Consumer Worker', function(){
    var consumer = {};
    before((done) => {
        //logger, beanstalk_url, beanstalk_port, beanstalk_tube, db_url, db_port,db_name
        consumer = new Consumer(log, test_config.beanstalk.host, test_config.beanstalk.port, test_config.beanstalk.tube,
            test_config.mongodb.host, test_config.mongodb.port, test_config.mongodb.database);

        // generate 5 random jobs in the beanstalk
        exec(format(produce_command, {
            njobs: '5',
            host: test_config.beanstalk.host,
            port: test_config.beanstalk.port,
            tube: test_config.beanstalk.tube
        }), function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
                process.exit(1);
            }
            done();
        });
        //done();
    });

    it('Should retrieve job in beanstalk correctly upon call to queryBeanstalk', () => {
        let p1 = consumer.obtainBeanstalkConnection()
            .then(consumer.queryBeanstalk.bind(consumer)).then((req) => {
                    assert.equal(true, req instanceof CurrencyRateRequest, "query beanstalk error");
                }, (err) => {
                    // shouldn't come here
                    assert.equal(1, 0, "Incorrect: queryBeanstalk failure");
                });
        return Promise.all([p1]);
    });

    it('Should validate the incoming currency rate request on call to validateCurrencyRateRequest', () => {
        // test validation failures
        // case : previously sucessful job invalid for execution
        let r1 = new CurrencyRateRequest('HKD', 'USD', 1, new Date().getTime(), 1, 2);
        let p1 = consumer.validateCurrencyRateRequest(r1).then(
            () => {assert.equal(1, 0, "Incorrect: Validation success")},
            () => {assert.equal(1, 1, "Correct: Validation failure")}
        );

        // case : previously failed job invalid for execution
        let r2 = new CurrencyRateRequest('HKD', 'USD', 1, 1, 1, new Date().getTime());
        let p2 = consumer.validateCurrencyRateRequest(r2).then(
            () => {assert.equal(1, 0, "Incorrect: Validation success")},
            () => {assert.equal(1, 1, "Correct: Validation failure")}
        );

        // test validation success
        // case : previously failed job valid for execution
        let r3 = new CurrencyRateRequest('HKD', 'USD', 1, 1, 1, 2);
        let p3 = consumer.validateCurrencyRateRequest(r3).then(
            () => {assert.equal(1, 1, "Correct: Validation success")},
            () => {assert.equal(1, 0, "Incorrect: Validation failure")}
        );

        // case : previously successful job valid for execution
        let r4 = new CurrencyRateRequest('HKD', 'USD', 1, 2, 1, 1);
        let p4 = consumer.validateCurrencyRateRequest(r4).then(
            () => {assert.equal(1, 1, "Correct: Validation success")},
            () => {assert.equal(1, 0, "Incorrect: Validation failure")}
        );

        return Promise.all([p1, p2, p3, p4]);
    });

    it('Should return the cleaned and rounded exchange rate on call to processScrappedRate', () => {
        // test validation failures
        // case : previously sucessful job invalid for execution
        let request = new CurrencyRateRequest('HKD', 'USD', 1, new Date().getTime(), 1, 2);
        let r1 = " 0.1232";
        let p1 = consumer.processScrappedRate([r1, request]).then(
            (data) => {assert.equal("0.12", data[0], "Correct")},
            (data) => {assert.equal("0.12", data[0], "Incorrect")}
        );

        let r2 = " 1.1992 ";
        let p2 = consumer.processScrappedRate([r2, request]).then(
            (data) => {assert.equal("1.20", data[0], "Correct")},
            (data) => {assert.equal("1.20", data[0], "Incorrect")}
        );

        return Promise.all([p1, p2]);
    });



    after(() => {

    });
});
