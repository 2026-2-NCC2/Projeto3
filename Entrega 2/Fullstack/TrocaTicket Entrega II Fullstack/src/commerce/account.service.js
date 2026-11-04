'use strict';

const { createHash, randomInt } = require('node:crypto');
const nodemailer = require('nodemailer');
const config = require('../config');
const { HttpError } = require('../errors');
const { hashPassword } = require('../auth/password');
const { text, uid, now, one, rows, transact, audit } = require('./core');
const hash = (id,code) => createHash('sha256').update(id+code+config.auth.secret).digest('hex');
function validPassword(value) {
  if (typeof value!=='string' || value.length<8 || value.length>72 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new HttpError(400,'Use de 8 a 72 caracteres, com letras e números.');
  }
}
async function requestRecovery(body) {
  const email=text(body.email,'e-mail',3,160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400,'Informe um e-mail válido.');
  if (!config.demo && !process.env.SMTP_HOST) throw new HttpError(503,'O envio de e-mail ainda não foi configurado nesta instalação.');
  const id=uid(), otp=String(randomInt(100000,1000000));
  const user=await transact(async db=>{
    const recent=await one('SELECT criado_ms FROM recuperacoes WHERE email=? ORDER BY criado_ms DESC LIMIT 1',[email],db);
    if (recent && now()-recent.criado_ms<60000) throw new HttpError(429,'Aguarde um minuto para solicitar outro código.');
    const user=await one('SELECT id FROM usuarios WHERE email=?',[email],db);
    await db.query('UPDATE recuperacoes SET usado=1 WHERE email=?',[email]);
    await db.query('INSERT INTO recuperacoes (id,usuario_id,email,codigo_hash,expira_ms,criado_ms) VALUES (?,?,?,?,?,?)',
      [id,user?.id??null,email,hash(id,otp),now()+600000,now()]);
    return user;
  });
  if (user && !config.demo) {
    const smtp=nodemailer.createTransport({
      host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',
      auth:process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD} : undefined,
    });
    try {
      await smtp.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'TrocaTicket - recuperar senha',
        text:`Seu código é ${otp}. Ele expira em 10 minutos. Se você não solicitou, ignore esta mensagem.`});
    } catch (error) {
      console.error('Falha no envio de recuperação:',error.code||'SMTP');
      throw new HttpError(503,'Não foi possível enviar o código. Tente novamente mais tarde.');
    }
  }
  return { id,mensagem:'Se o e-mail estiver cadastrado, você receberá um código válido por 10 minutos.',
    ...(config.demo ? {codigo_demo:otp,canal:'Caixa de e-mail simulada nesta apresentação'} : {}) };
}
async function resetPassword(body) {
  validPassword(body.senha);
  if (body.senha!==body.confirmacao) throw new HttpError(400,'A confirmação de senha precisa ser igual.');
  const newHash=await hashPassword(body.senha);
  const result=await transact(async db=>{
    const recovery=await one('SELECT * FROM recuperacoes WHERE id=?',[body.id||''],db);
    if (!recovery || recovery.usado || recovery.expira_ms<=now() || recovery.tentativas>=5) return false;
    if (hash(recovery.id,String(body.codigo||''))!==recovery.codigo_hash || !recovery.usuario_id) {
      await db.query('UPDATE recuperacoes SET tentativas=tentativas+1 WHERE id=?',[recovery.id]);
      return false;
    }
    await db.query('UPDATE usuarios SET senha_hash=? WHERE id=?',[newHash,recovery.usuario_id]);
    const version=await one('SELECT versao FROM versoes_sessao WHERE usuario_id=?',[recovery.usuario_id],db);
    if (version) await db.query('UPDATE versoes_sessao SET versao=versao+1 WHERE usuario_id=?',[recovery.usuario_id]);
    else await db.query('INSERT INTO versoes_sessao (usuario_id,versao) VALUES (?,1)',[recovery.usuario_id]);
    await db.query('UPDATE recuperacoes SET usado=1 WHERE usuario_id=?',[recovery.usuario_id]);
    await audit(db,{id:recovery.usuario_id},'redefinir_senha',recovery.usuario_id);
    return true;
  });
  if (!result) throw new HttpError(400,'Código inválido, expirado ou com limite de tentativas atingido.');
  return {mensagem:'Senha redefinida. Entre com sua nova senha.'};
}
async function updateProfile(user,body) {
  const nome=text(body.nome,'nome',3,120),telefone=text(body.telefone||'Não informado','telefone',3,20);
  await transact(async db=>{
    await db.query('UPDATE usuarios SET nome=?,telefone=? WHERE id=?',[nome,telefone,user.id]);
    await audit(db,user,'atualizar_perfil',user.id);
  });
}
async function notifications(user) {
  return rows('SELECT * FROM notificacoes WHERE usuario_id=? ORDER BY criado_ms DESC LIMIT 50',[user.id]);
}
const readNotifications=user=>transact(db=>db.query('UPDATE notificacoes SET lida=1 WHERE usuario_id=?',[user.id]));
module.exports={requestRecovery,resetPassword,updateProfile,notifications,readNotifications};
