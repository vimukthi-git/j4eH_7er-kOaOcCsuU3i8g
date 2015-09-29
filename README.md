# Exchange Worker

> A beanstalk helper has following features.

- Can run a cluster or a fully distributed set of independent workers to process currency exchange rate requests
- Connects to Beanstalkd as the queue manager
- Uses ES6 with nodejs 4.x.x
- Uses JSHint for linting
- Uses Mocha for unit testing

## Prerequisites

- This app will NOT run on node versions lower than 4.0.0. So install the latest stable version of node.
- Have beanstalkd and mongodb ready.
- Install grunt commandline tool - `npm install -g grunt-cli`
- Run `npm install` on the root dir once you have the enviroment ready.

## Usage

Exchange worker comes with two scripts which you can use,

1. runner.js - Creates Exchange workers based on the config file provided. Sample usage, `node runner.js -f ./default_config.json`

2. producer.js - Adds jobs to the beanstalkd queue based on the args provided. Sample usage, `node producer.js -n 5 -h 127.0.0.1 -p 11300 -t test_tube`

You can run unit tests using,

`grunt test`

Lint using,

`grunt lint`

## License

MIT © [Vimukthi Bandara](http://vimukthi.com)


