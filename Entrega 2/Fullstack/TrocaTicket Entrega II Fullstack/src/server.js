'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./db');

let server;
async function start() {
  await require('./commerce/init').initialize();
  await db.ping();
  server = app.listen(config.port, config.demo ? '127.0.0.1' : undefined, () => {
    console.log(`TrocaTicket pronto em http://127.0.0.1:${config.port}`);
    console.log(config.demo ? 'Apresentação com banco SQLite persistente.' : 'MySQL conectado.');
  });
  server.on('error', error => {
    console.error(error.code==='EADDRINUSE' ? 'A porta está ocupada. Feche a versão anterior ou altere PORT.' : error.message);
    db.close().finally(()=>process.exit(1));
  });
}
start().catch(error => {
  console.error('Não foi possível iniciar o TrocaTicket:',error.message);
  db.close().finally(()=>process.exit(1));
});

let shuttingDown = false;

/** Fecha conexões HTTP em andamento, depois o pool MySQL. Força saída após 10s. */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} recebido. Encerrando com elegância...`);

  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();

  if (!server) return db.close().finally(()=>process.exit(0));
  server.close(async () => {
    try {
      await db.close();
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
