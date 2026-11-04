'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const mysql = require('mysql2/promise');
const config = require('../src/config');
(async()=>{
  const conn=await mysql.createConnection({
    host:config.db.host,port:config.db.port,user:config.db.user,password:config.db.password,multipleStatements:true,
  });
  try{
    // O schema original mantém o nome acadêmico trocaticket.
    await conn.query(readFileSync(join(__dirname,'../db/schema.sql'),'utf8'));
    await conn.query("ALTER TABLE usuarios MODIFY perfil ENUM('administrador','organizador','fornecedor','comprador','revendedor') NOT NULL");
    await conn.query(readFileSync(join(__dirname,'../db/commerce.sql'),'utf8'));
    if(process.argv.includes('--demo')){
      const [[{n}]]=await conn.query('SELECT COUNT(*) AS n FROM usuarios');
      if(!n)await conn.query(readFileSync(join(__dirname,'../db/seed.sql'),'utf8'));
    }
    if(process.argv.includes('--demo')){
      process.env.SEED_COMMERCE_DEMO='1';
      await require('../src/commerce/init').initialize();
      await require('../src/db').close();
    }
    console.log('Esquema MySQL pronto. Inicie a aplicação com npm start.');
  }finally{await conn.end();}
})().catch(error=>{console.error('Não foi possível preparar o MySQL:',error.message);process.exitCode=1;});
