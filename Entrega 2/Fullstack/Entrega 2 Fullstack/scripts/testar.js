'use strict';

const { spawn,spawnSync }=require('node:child_process');
const { mkdtempSync,rmSync }=require('node:fs');
const { tmpdir }=require('node:os');
const { join }=require('node:path');
const testDir=mkdtempSync(join(tmpdir(),'trocaticket-test-'));
const port=process.env.TEST_PORT||'3187';
const env={...process.env,PORT:port,DEMO_DB_PATH:join(testDir,'test.sqlite'),
  TROCATICKET_APRESENTACAO:'1',API_URL:`http://127.0.0.1:${port}/api`};
let server,log='';
function start() {
  server=spawn(process.execPath,['scripts/apresentacao.js'],{env,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>{log+=b;});server.stderr.on('data',b=>{log+=b;});
}
async function ready(){
  for(let attempt=0;attempt<100;attempt++){
    if(server.exitCode!==null)throw Error(log);
    try{if((await fetch(env.API_URL+'/health')).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('O servidor de testes não iniciou. '+log);
}
async function stop(){
  if(!server || server.exitCode!==null)return;
  const finished=new Promise(resolve=>server.once('exit',resolve));
  server.kill('SIGTERM');await finished;
}
async function main(){
  const unit=spawnSync(process.execPath,['--test','test/unit/ticket.test.js','test/unit/seguranca.test.js','test/unit/validadores.test.js'],{env,stdio:'inherit'});
  if(unit.status!==0)throw Error('Testes unitários falharam.');
  start();await ready();
  const result=await new Promise(resolve=>{
    const child=spawn(process.execPath,['--test','--test-concurrency=1','test/integration/fluxo.api.test.js','test/integration/commerce.api.test.js'],{env,stdio:'inherit'});
    child.once('exit',resolve);
  });
  if(result!==0)throw Error('Testes de integração falharam.');
  const auth=await fetch(env.API_URL+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'organizador@demo.com',senha:'Demo@2026'})}).then(r=>r.json());
  await stop();start();await ready();
  const restored=await fetch(env.API_URL+'/auth/me',{headers:{Authorization:'Bearer '+auth.token}});
  if(restored.status!==200)throw Error('A sessão não persistiu após reiniciar.');
  console.log('Sessão e banco preservados após reiniciar o servidor.');
}
main().catch(error=>{console.error(error.message);console.error(log);process.exitCode=1;}).finally(async()=>{
  await stop();rmSync(testDir,{recursive:true,force:true});
});
