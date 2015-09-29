# Exchange Worker

> A beanstalk helper has following features.

- Can run a cluster or a fully distributed set of independent workers(state is store in the job it self) to process currency exchange rate requests
- Connects to Beanstalkd as the queue manager
- Uses mongodb to store processed exchange rate requests
- Scraps xe.com for latest exchange rates.
- Uses ES6 with nodejs 4.x.x
- Uses JSHint for linting
- Uses Mocha for unit testing

### App main file structure

- bin/runner.js - worker run utility
- bin/producer.js - exchange job producer
- bin/default_config.json - example config file used as default by the worker
- src/consumer.js - main worker class
- src/constants.js - some common constants
- src/model/currency_rate_request.js - model for currency rate requests
- src/model/currency_rate_result.js - model for currency rate results
- src/test/test.js - unit tests based on mocha



## Prerequisites

- This app will NOT run on node versions lower than 4.0.0. So install the latest stable version of node.
- Have beanstalkd and mongodb ready.
- Install grunt commandline tool - `npm install -g grunt-cli`
- Run `npm install` on the root dir once you have the enviroment ready.

## Usage

Exchange worker comes with two scripts which you can use in the `bin` directory,

1. runner.js - Creates Exchange workers based on the config file provided. Sample usage, `node runner.js -f ./default_config.json`

2. producer.js - Adds random exchange rate jobs to the beanstalkd queue based on the args provided. Sample usage, `node producer.js -n 5 -h 127.0.0.1 -p 11300 -t test_tube`

### Config file format for runner.js

{

  "num_forks": 3, // Number of node js cluster workers to create. Note that these are independant and shares nothing.

  "process_frquency" : 3000, // Number of millis each worker waits before querying the queue.

  "success_wait_duration": 60000, // How many millis before successful job is executed again

  "successful_retry_count": 10, // Number of times successful jobs are re-executed

  "failed_wait_duration": 3000, // How many millis before a failed job is executed again

  "failed_retry_count": 3, // Number of times failed jobs are tried to re-execute before failing permanantly

// Beanstalkd config

  "beanstalk" :{

    "host": "challenge.aftership.net",

    "port" : 11300,

    "tube": "vimukthi-git-1"

  },

// mongodb config

  "mongodb" :{

    "host"     : "127.0.0.1",

    "port"     : "27017",

    "database" : "vimukthi-git-rem-1",
    
    "user" : "",
        
    "passwd" : ""

  },

// logging config

  "logging" : {
  
    "name" : "ExchangeWorker",
    
    "src": true,
    
    "streams": [
    
      {
      
        "type": "rotating-file",
        
        "path": "./worker.log",
        
        "period": "1d",
        
        "count": 10
        
      }
      
    ],
    
    "console-log": true
    
  }
  
}

### Build

You can run unit tests using,

`grunt test`

Lint using,

`grunt lint`

## License

MIT © [Vimukthi Bandara](http://vimukthi.com)


