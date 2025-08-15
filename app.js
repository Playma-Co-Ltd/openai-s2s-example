require('dotenv').config();
const {createServer} = require('http');
const {createEndpoint} = require('@jambonz/node-client-ws');
const logger = require('pino')({level: process.env.LOGLEVEL || 'info'});
const server = createServer();
server.on('upgrade', (req, socket, head) => {
  logger.info('🔄 WebSocket Upgrade:', req.url);
});
const makeService = createEndpoint({server});
const port = process.env.WS_PORT || 3000;

require('./lib/routes')({logger, makeService});

server.listen(port, () => {
  logger.info(`jambonz websocket server listening at http://localhost:${port}`);
});
