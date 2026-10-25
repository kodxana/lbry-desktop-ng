// On Web, this will find .env.defaults and optional .env in web/
// On Desktop App, this will find .env.defaults and optional .env in root dir
require('dotenv-defaults').config({ silent: false });

module.exports = require('./configValues');
