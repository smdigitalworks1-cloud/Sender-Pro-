const app = require('../backend/app');
const serverless = require("serverless-http");

module.exports = app;
module.exports.handler = serverless(app);
