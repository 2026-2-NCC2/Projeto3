'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const config = require('../config');
const { hashPassword } = require('../auth/password');
const { pool, one, uid, code, now, rows, transact } = require('./core');

async function initialize() {
  if (config.demo) {
    const sql = readFileSync(join(__dirname, '../../db/commerce.sql'), 'utf8');
    for (const statement of sql.split(';').map(v => v.trim()).filter(Boolean)) await pool.query(statement);
  } else {
    try { await pool.query('SELECT id FROM commerce_meta LIMIT 0'); }
    catch { throw new Error('Esquema do comércio ausente. Execute npm run db:init com credenciais de criação do banco.'); }
  }
  if (!await one("SELECT id FROM commerce_meta WHERE id = 'regras'")) {
    await pool.query('INSERT INTO commerce_meta (id, value) VALUES (?, ?)', ['regras', JSON.stringify({
      conveniencia_bp: 150, revenda_bp: 150, margem_revenda_bp: 2000, moderar_revenda: true,
    })]);
  }
  await pool.query("UPDATE usuarios SET perfil = 'comprador' WHERE perfil = 'revendedor'");
  if ((!config.demo && process.env.SEED_COMMERCE_DEMO !== '1') || await one("SELECT id FROM commerce_meta WHERE id = 'seed_v3'")) return;
  await transact(async db => {
  if (await one("SELECT id FROM commerce_meta WHERE id = 'seed_v3'",[],db)) return;
  const password = await hashPassword('Demo@2026');
  for(const [name,email] of [['Comprador Demo','comprador@demo.com'],['Fã de Eventos','revendedor@demo.com']]){
    if(!await one('SELECT id FROM usuarios WHERE email=?',[email],db)){
      await db.query("INSERT INTO usuarios (nome,email,senha_hash,perfil,status) VALUES (?,?,?,'comprador','aprovado')",[name,email,password]);
    }
  }
  const buyerId=(await one("SELECT id FROM usuarios WHERE email='comprador@demo.com'",[],db)).id;
  const sellerId=(await one("SELECT id FROM usuarios WHERE email='revendedor@demo.com'",[],db)).id;
  await db.query("UPDATE usuarios SET senha_hash = ? WHERE senha_hash = 'acesso-local'", [password]);
  const events = await rows('SELECT * FROM eventos WHERE organizador_id = 2 ORDER BY id LIMIT 1',[],db);
  let eventId = events[0]?.id;
  if (!eventId) {
    const [r] = await db.query(`INSERT INTO eventos (organizador_id, nome, descricao, local_evento, data_inicio,
      data_fim, publico_minimo, publico_maximo, publico_esperado, margem_lucro_percentual, status)
      VALUES (2, ?, ?, ?, ?, ?, 200, 800, 500, 20, 'publicado')`, [
      'Sunset Festival', 'Música, encontros e um pôr do sol para ficar na memória.', 'Parque Villa-Lobos, São Paulo',
      future(30,18),future(31,3)]);
    eventId = r.insertId;
  }
  const seeds = [
    [eventId, 'Sunset Festival', 'Música eletrônica, arte e encontros ao ar livre. Viva a cidade em outro ritmo.', 'Parque Villa-Lobos, São Paulo', 'São Paulo', 'Eletrônica', 'sunset', 30, 12000],
    [null, 'Sons da Cidade', 'Uma noite para cantar junto. Bandas independentes, novas vozes e boa companhia.', 'Espaço Unimed, São Paulo', 'São Paulo', 'Indie & Rock', 'indie', 37, 8500],
    [null, 'Horizonte Jazz', 'Jazz contemporâneo, gastronomia e uma atmosfera feita para desacelerar.', 'Fundição Progresso, Rio de Janeiro', 'Rio de Janeiro', 'Jazz & Blues', 'jazz', 45, 6500],
    [null, 'Campus Connect', 'Ideias que conectam. Criatividade, tecnologia e o futuro em uma experiência universitária.', 'Centro de Convenções, Belo Horizonte', 'Belo Horizonte', 'Universitário', 'campus', 51, 4500],
  ];
  for (let [id, name, description, place, city, category, art, days, price] of seeds) {
    if (!id) {
      const [result] = await db.query(`INSERT INTO eventos (organizador_id,nome,descricao,local_evento,data_inicio,data_fim,
        publico_minimo,publico_maximo,publico_esperado,margem_lucro_percentual,status) VALUES (2,?,?,?,?,?,100,600,400,20,'publicado')`,
        [name, description, place, future(days,18),future(days+1,2)]);
      id = result.insertId;
    } else {
      await db.query("UPDATE eventos SET nome = ?, descricao = ?, local_evento = ? WHERE id = ?", [name, description,place,id]);
    }
    await db.query("INSERT INTO catalogo (evento_id,cidade,categoria,arte,moderacao,destaque) VALUES (?,?,?,?,'aprovado',1)", [id,city,category,art]);
    const lote = uid();
    await db.query('INSERT INTO lotes (id,evento_id,nome,setor,valor_centavos,capacidade) VALUES (?,?,?,?,?,?)',
      [lote,id,'1º lote','Pista',price,500]);
    await db.query('INSERT INTO lotes (id,evento_id,nome,setor,valor_centavos,capacidade) VALUES (?,?,?,?,?,?)',
      [uid(),id,'Lote especial','Área VIP',price*2,100]);
    if (art === 'sunset') {
      await seedTicket(db,lote,buyerId,price,false);
      await seedTicket(db,lote,sellerId,price,true);
    }
  }
  await db.query('INSERT INTO servicos (id,fornecedor_id,titulo,categoria,descricao,valor_centavos,portfolio_url) VALUES (?,4,?,?,?,?,?)',
    [uid(),'Catering para eventos','Alimentação','Cardápio completo com opções vegetarianas. Equipe, montagem e atendimento inclusos.',950000,null]);
  await db.query('INSERT INTO commerce_meta (id,value) VALUES (?,?)', ['seed_v3','1']);
  });
}
function future(days, hour) {
  const date = new Date(Date.now() + days*86400000);
  return date.toISOString().slice(0,10)+` ${String(hour).padStart(2,'0')}:00:00`;
}
async function seedTicket(db,lote, buyer, price, list) {
  const reserva=uid(), pedido=uid(), ticket=uid();
  await db.query("INSERT INTO reservas (id,visitante,usuario_id,lote_id,quantidade,expira_ms,status) VALUES (?,'seed',?,?,1,?,'convertida')", [reserva,buyer,lote,now()]);
  await db.query(`INSERT INTO pedidos (id,reserva_id,comprador_id,vendedor_id,lote_id,tipo,quantidade,valor_centavos,taxa_centavos,total_centavos,liquido_centavos,status,metodo,criado_ms)
    VALUES (?,?,?,2,?,'primario',1,?,0,?,?,'retido','pix',?)`, [pedido,reserva,buyer,lote,price,price,price,now()]);
  await db.query('INSERT INTO ingressos (id,lote_id,dono_id,pedido_id,original_pedido_id,valor_original,codigo) VALUES (?,?,?,?,?,?,?)',[ticket,lote,buyer,pedido,pedido,price,code()]);
  if (list) await db.query("INSERT INTO anuncios (id,ingresso_id,vendedor_id,anterior_pedido_id,preco_centavos,status,criado_ms) VALUES (?,?,?,?,?,'publicado',?)",
    [uid(),ticket,buyer,pedido,price,now()]);
}
module.exports = { initialize };
