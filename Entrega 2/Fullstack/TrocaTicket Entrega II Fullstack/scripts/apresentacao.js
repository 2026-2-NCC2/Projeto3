'use strict';

if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Instale o Node.js 24 LTS para rodar a apresentação.');
  process.exit(1);
}

process.env.NODE_ENV = 'development';
process.env.TROCATICKET_APRESENTACAO = '1';
const { readFileSync,writeFileSync,mkdirSync } = require('node:fs');
const { join,dirname,resolve } = require('node:path');
const dataFile=resolve(process.env.DEMO_DB_PATH || join(__dirname,'../.dados/apresentacao.sqlite'));
process.env.DEMO_DB_PATH=dataFile;
mkdirSync(dirname(dataFile),{recursive:true});
const keyFile=dataFile+'.session-key';
try { process.env.AUTH_SECRET=readFileSync(keyFile,'utf8'); }
catch {
  process.env.AUTH_SECRET=require('node:crypto').randomBytes(48).toString('base64url');
  writeFileSync(keyFile,process.env.AUTH_SECRET,{mode:0o600,flag:'wx'});
}
process.env.TZ = 'America/Sao_Paulo';
require('../src/server');
