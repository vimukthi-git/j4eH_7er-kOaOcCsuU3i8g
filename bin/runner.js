#!/usr/bin/env node

'use strict';

let Consumer = require('./../src/consumer');
let Constants = require('./../src/constants');
let bunyan = require('bunyan');
let minimist = require('minimist');
let cluster = require('cluster');

let args = minimist(process.argv.slice(2));
let config_filename = args['f'];

if(config_filename) {

    let configs = require(config_filename);

    if (cluster.isMaster) {

        // Fork workers.
        for (var i = 0; i < configs.num_forks; i++) {
            cluster.fork();
        }

        cluster.on('exit', function (worker, code, signal) {
            console.log('worker ' + worker.process.pid + ' died');
        });


    } else {
        if(configs.logging['console-log']){
            configs.logging['streams'].push({
                stream: process.stdout
            });
        }
        let logger = bunyan.createLogger(configs.logging);

        let c = new Consumer(logger, configs.beanstalk.host, configs.beanstalk.port,
            Constants.BS_TUBE_NAME, configs.mongodb.host, configs.mongodb.port,
            configs.mongodb.database, configs.process_frequency, configs.success_wait_duration,
            configs.successful_retry_count, configs.failed_wait_duration, configs.failed_retry_count);

        c.start();

        process.on('SIGINT', function () {
            c.stop();
            process.exit();
        });
    }
} else {
    console.log("Please Provide a relative path for a valid config file with option -f");
}


