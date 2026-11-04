'use strict';

const config = require('./config');
module.exports = config.demo ? require('./db-demo') : require('./db-mysql');
