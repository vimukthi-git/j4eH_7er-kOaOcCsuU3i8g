#!/usr/bin/env node

'use strict';

let Consumer = require('./../src/consumer');
let Constants = require('./../src/constants');
let bunyan = require('bunyan');
let minimist = require('minimist');
let cluster = require('cluster');
let Logger = require('@aftership/logger');

let args = minimist(process.argv.slice(2));
let config_filename = args['f'];

if(config_filename) {

    let configs = require(config_filename);
    const aftership_config = require('@aftership/aftership-config');
    let config = aftership_config.getConfig('development');

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

        //let logger = bunyan.createLogger(configs.logging);
        let redis = require("redis"),
        client = redis.createClient();


        let logger = new Logger({
           subject: 'general',
           version: 'v2',
           key: 'foo',
           redis_client: client // a redis client that's properly configurated and connected
       });

        let c = new Consumer(logger, configs.beanstalk.host, configs.beanstalk.port,
            configs.beanstalk.tube, config.db.host, config.db.port,
            config.db.database, config.db.user, config.db.passwd,
            configs.process_frequency, configs.success_wait_duration,
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
