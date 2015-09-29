#!/usr/bin/env node

'use strict';

/**
 *
 * Randomly generates and injects CurrencyRateRequest objects to beanstalk
 */

var fivebeans = require('fivebeans');
var RateRequest = require('../src/model/currency_rate_request');
var Constants = require('../src/constants');
var minimist = require('minimist');

var args = minimist(process.argv.slice(2));
var num_jobs = args['n'] || 1;
var host = args['h'] || '127.0.0.1';
var port = args['p'] || 11300;
var tube = args['t'] || Constants.BS_TUBE_NAME;

var client = new fivebeans.client(host, port);

client.on('connect', function() {
        client.use(tube, function(err, tubename) {
                        if(err) {

                        } else {
                            addJob();
                        }
                    });
    })
    .on('error', function(err)
    {
        // connection failure
    })
    .on('close', function()
    {
        // underlying connection has closed
    })
    .connect();

var currencies = ['LKR', 'USD', 'HKD', 'EUR'];
var count_added = 0;
function addJob(){
    _shuffle(currencies);
    let r = new RateRequest(currencies[0], currencies[1]);
    client.put(1, 0, 100, JSON.stringify(r), function(err, jobid) {
        count_added++;
        console.log(jobid);
        //console.log(r);
        if(count_added === num_jobs){
            client.quit();
        } else {
            addJob();
        }
    });
}

/**
 * Shuffle the given array with a random order
 * used to generate random game board colors for each new round
 * @param array
 * @returns {*}
 * @private
 */
function _shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
