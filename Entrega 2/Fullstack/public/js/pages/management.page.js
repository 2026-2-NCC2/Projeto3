import { get,post,patch } from '../api/commerce.api.js';
import { authApi } from '../api/auth.api.js';
import { session } from '../session.js';
import { esc,money,date,heading,badge,empty,field,errorBox,formAction,cents,busy } from '../components/ui.js';
import { renderLoading } from '../components/state-view.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { toast } from '../components/toast.js';
const categories=['Eletrônica','Indie & Rock','Jazz & Blues','Universitário','Sertanejo','Pop','Cultura','Outros'];
const refresh=()=>window.dispatchEvent(new Event('rota-atualizar'));
const stat=(label,value,detail='')=>`<article class="stat-card"><p class="muted small">${label}</p><strong>${value}</strong><span class="small muted">${detail}</span></article>`;

export async function renderEventSales({id},query,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Atualizando vendas do evento...');
  const [data,event]=await Promise.all([get('/gestao/eventos/'+id),import('../api/eventos.api.js').then(m=>m.eventosApi.get(id))]);
  if(!isCurrent())return;
  const active=data.pedidos.filter(p=>p.status!=='estornado' && p.tipo==='primario');
  const revenue=active.reduce((sum,p)=>sum+p.valor_centavos,0);
  const sold=active.reduce((sum,p)=>sum+p.quantidade,0);
  const tabs=[['painel','Visão geral'],['lotes','Lotes e publicação'],['checkin','Check-in']];
  const tab=tabs.some(([v])=>v===query.aba)?query.aba:'painel';
  app.innerHTML=heading('PORTAL DO ORGANIZADOR',event.nome,'Acompanhe vendas, publique lotes e receba seu público.',
    `<a class="btn btn-secondary" href="#/eventos/${id}">Planejamento e custos</a><a class="btn btn-secondary" href="#/explorar/${id}">Ver página pública ↗</a>`)+
    `<nav class="tabs">${tabs.map(([key,label])=>`<a class="tab ${key===tab?'ativa':''}" href="#/gestao/eventos/${id}?aba=${key}">${label}</a>`).join('')}</nav>`;
  if(tab==='painel'){
    app.innerHTML+=`<div class="stats-grid" id="event-stats">${stat('Receita primária',money(revenue),'Valores de compras ativas')}${stat('Ingressos vendidos',sold,'Vendas primárias')}${stat('Check-ins',data.checkins,'Entradas validadas')}${stat('Ocupação',Math.round(sold/event.publico_maximo*100)+'%','Capacidade de '+event.publico_maximo+' pessoas')}</div>
      <div class="dashboard-grid"><section class="card"><div class="section-heading"><h2>Vendas por dia</h2><span class="live-tag">● Atualização a cada 30s</span></div>
      <div class="sales-bars">${Object.entries(data.diario).map(([day,value])=>`<div class="bar-row"><span>${esc(day.split('-').reverse().slice(0,2).join('/'))}</span><div><i style="width:${Math.max(2,value/Math.max(...Object.values(data.diario))*100)}%"></i></div><strong>${money(value)}</strong></div>`).join('')||empty('Aguardando a primeira venda')}</div>
      </section><section class="card"><p class="eyebrow">CATÁLOGO</p><h2>Pronto para o público?</h2>${badge(data.catalogo?.moderacao||'pendente')}<p class="muted">Configure cidade, categoria e lotes. A publicação fica disponível após aprovação da administração.</p><a class="btn btn-primary" href="#/gestao/eventos/${id}?aba=lotes">Gerenciar publicação</a></section></div>
      <section class="card"><h2>Transações do evento</h2><div class="table-wrapper"><table class="table"><thead><tr><th>Comprador</th><th>Origem</th><th>Quantidade</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${data.pedidos.map(p=>`<tr><td>${esc(p.comprador)}</td><td>${p.tipo==='primario'?'Oficial':'Revenda'}</td><td>${p.quantidade}</td><td>${money(p.total_centavos)}</td><td>${badge(p.status)}</td></tr>`).join('')||'<tr><td colspan="5">Nenhuma transação.</td></tr>'}</tbody></table></div></section>`;
    const poll=async()=>{
      if(!isCurrent())return;
      try{
        const latest=await get('/gestao/eventos/'+id);
        if(!isCurrent())return;
        const primary=latest.pedidos.filter(p=>p.status!=='estornado' && p.tipo==='primario');
        const revenue=primary.reduce((s,p)=>s+p.valor_centavos,0),sold=primary.reduce((s,p)=>s+p.quantidade,0);
        app.querySelector('#event-stats').innerHTML=stat('Receita primária',money(revenue))+stat('Ingressos vendidos',sold)+stat('Check-ins',latest.checkins)+stat('Ocupação',Math.round(sold/event.publico_maximo*100)+'%');
      }catch(error){if(isCurrent())toast.error('Atualização de vendas: '+error.message);}
      if(isCurrent())setTimeout(poll,30000);
    };setTimeout(poll,30000);
  }
  if(tab==='lotes'){
    app.innerHTML+=`<div class="dashboard-grid"><section class="card"><h2>Publicação do evento</h2><form id="publish-catalog" class="stack">
      ${field('cidade','Cidade','text','required minlength="2" maxlength="120"',data.catalogo?.cidade||'')}
      <label class="field">Categoria<select name="categoria">${categories.map(c=>`<option ${data.catalogo?.categoria===c?'selected':''}>${c}</option>`).join('')}</select></label>${errorBox}
      <button class="btn btn-primary" type="submit">Salvar e enviar para publicação</button></form></section>
      <section class="card"><div class="section-heading"><h2>Lotes de ingressos</h2><button class="btn btn-primary btn-sm" data-new-lot>+ Criar lote</button></div><div class="lot-list">
        ${data.lotes.map(l=>`<article><div><h3>${esc(l.setor)} · ${esc(l.nome)}</h3><p class="small muted">${l.disponiveis} disponíveis / ${l.capacidade} · ${l.ativo?'Vendas abertas':'Pausado'}</p></div><div><strong>${money(l.valor_centavos)}</strong><button class="text-button" data-edit-lot="${l.id}">Editar</button></div></article>`).join('')||'<p class="muted">Crie o primeiro lote para começar a vender.</p>'}
      </div></section></div><section class="danger-panel"><div><h3>Cancelar evento</h3><p>Compras ativas serão estornadas e os ingressos serão invalidados.</p></div><button class="btn btn-danger" id="cancel-event" ${event.status==='cancelado'?'disabled':''}>Cancelar evento</button></section>`;
    formAction(app.querySelector('#publish-catalog'),async body=>{
      await post('/gestao/eventos/'+id+'/catalogo',body);toast.success('Publicação salva. Confira o status de moderação.');if(isCurrent())refresh();
    });
    const editLot=lot=>{
      const {element,close}=openModal(lot?'Editar lote':'Criar lote',`<form class="stack">
        ${field('nome','Nome do lote','text','required maxlength="100"',lot?.nome||'')}
        ${field('setor','Setor','text','required maxlength="100"',lot?.setor||'')}
        ${field('preco','Preço (R$)','number','required min="1" step=".01"',lot?lot.valor_centavos/100:'')}
        ${field('capacidade','Quantidade de ingressos','number','required min="1" max="1000000" step="1"',lot?.capacidade||'')}
        ${lot?`<label class="check-label"><input type="checkbox" name="ativo" ${lot.ativo?'checked':''}> Lote aberto para vendas</label>`:''}
        ${errorBox}<button class="btn btn-primary" type="submit">Salvar lote</button></form>`);
      formAction(element.querySelector('form'),async data=>{
        await post('/gestao/eventos/'+id+'/lotes',{id:lot?.id,nome:data.nome,setor:data.setor,valor_centavos:cents(data.preco),capacidade:Number(data.capacidade),ativo:!lot||data.ativo==='on'});
        close();toast.success('Lote salvo.');if(isCurrent())refresh();
      });
    };
    app.querySelector('[data-new-lot]').onclick=()=>editLot();
    app.querySelectorAll('[data-edit-lot]').forEach(b=>b.onclick=()=>editLot(data.lotes.find(l=>l.id===b.dataset.editLot)));
    app.querySelector('#cancel-event').onclick=async e=>{
      const button=e.currentTarget;
      if(!await confirmDialog({title:'Cancelar o evento e estornar compras?',message:'Todos os ingressos serão invalidados e as compras ainda retidas serão estornadas integralmente.',confirmLabel:'Cancelar e estornar',danger:true}))return;
      busy(button,async()=>{await post('/gestao/eventos/'+id+'/cancelar');toast.success('Evento cancelado e compras estornadas.');if(isCurrent())refresh();});
    };
  }
  if(tab==='checkin'){
    app.innerHTML+=`<section class="card checkin-card"><span class="empty-symbol">▦</span><h2>Receba seu público</h2><p class="muted">Leia o QR com um leitor que digita o código ou cole o código completo do ingresso.</p><form class="stack">
    ${field('codigo','Código do ingresso','text','required autocomplete="off"')}${errorBox}<button class="btn btn-primary" type="submit">Validar entrada</button></form><div id="checkin-result" aria-live="polite"></div></section>`;
    formAction(app.querySelector('form'),async data=>{
      const result=await post('/gestao/eventos/'+id+'/checkin',data);if(!isCurrent())return;
      app.querySelector('#checkin-result').innerHTML=`<div class="notice success"><strong>Entrada validada ✓</strong><p>${esc(result.titular)}</p></div>`;
      app.querySelector('form').reset();
    });
  }
}
export async function renderSupplierServices(_p,_q,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Carregando seu portfólio...');
  const services=await get('/gestao/servicos');if(!isCurrent())return;
  app.innerHTML=heading('PORTAL DO FORNECEDOR','Meus serviços','Seu portfólio público para organizadores.', '<button class="btn btn-primary" id="new-service">+ Novo serviço</button>')+
    `<div class="service-grid">${services.map(s=>`<article class="card service-card"><span class="service-symbol">✦</span>${badge(s.ativo?'aprovado':'cancelado')}<p class="eyebrow">${esc(s.categoria)}</p><h2>${esc(s.titulo)}</h2><p>${esc(s.descricao)}</p><strong>${money(s.valor_centavos)}</strong><button class="btn btn-secondary" data-edit-service="${s.id}">Editar serviço</button></article>`).join('')}</div>`+
    (!services.length?empty('Mostre o que você faz','Adicione serviços para os organizadores conhecerem seu trabalho.'):'');
  const edit=s=>{
    const {element,close}=openModal(s?'Editar serviço':'Novo serviço',`<form class="stack">
      ${field('titulo','Título do serviço','text','required minlength="3" maxlength="100"',s?.titulo||'')}
      ${field('categoria','Categoria','text','required minlength="3" maxlength="80"',s?.categoria||'')}
      <label class="field">Descrição<textarea name="descricao" required minlength="10" maxlength="1000">${esc(s?.descricao||'')}</textarea></label>
      ${field('preco','Valor a partir de (R$)','number','required min="0" step=".01"',s?s.valor_centavos/100:'')}
      ${field('portfolio_url','Link HTTPS do portfólio (opcional)','url','',s?.portfolio_url||'')}
      ${s?`<label class="check-label"><input type="checkbox" name="ativo" ${s.ativo?'checked':''}> Exibir no perfil público</label>`:''}
      ${errorBox}<button class="btn btn-primary" type="submit">Salvar serviço</button></form>`);
    formAction(element.querySelector('form'),async data=>{
      await post('/gestao/servicos',{...data,id:s?.id,valor_centavos:cents(data.preco),ativo:!s||data.ativo==='on'});close();toast.success('Serviço salvo.');if(isCurrent())refresh();
    });
  };
  app.querySelector('#new-service').onclick=()=>edit();
  app.querySelectorAll('[data-edit-service]').forEach(b=>b.onclick=()=>edit(services.find(s=>s.id===b.dataset.editService)));
}
export async function renderContracts(_p,_q,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Consultando contratos...');
  const contracts=await get('/gestao/contratos');if(!isCurrent())return;
  app.innerHTML=heading('PORTAL DO FORNECEDOR','Contratos e entregas','As propostas selecionadas pelos organizadores aparecem aqui.')+
    `<div class="orders-list">${contracts.map(c=>`<article class="card order-card"><div>${badge(c.contrato_status)}<h2>${esc(c.evento_nome)}</h2><h3>${esc(c.item_nome)}</h3><p class="muted">${esc(c.descricao)}</p><p class="small">Organizador · ${esc(c.organizador)}</p></div><div class="order-values"><strong>${money(Number(c.valor)*100)}</strong>${c.contrato_status!=='concluido'?`<button class="btn btn-primary" data-complete="${c.proposta_id}">Marcar serviço entregue</button>`:''}</div></article>`).join('')}</div>`+
    (!contracts.length?empty('Aguardando uma proposta selecionada','Envie cotações no mural de oportunidades.','<a class="btn btn-primary" href="#/fornecedor/oportunidades">Ver oportunidades</a>'):'');
  app.querySelectorAll('[data-complete]').forEach(button=>button.onclick=async()=>{
    if(!await confirmDialog({title:'Concluir serviço?',message:'Confirma que os serviços contratados foram entregues?',confirmLabel:'Confirmar entrega'}))return;
    busy(button,async()=>{await post('/gestao/contratos/'+button.dataset.complete+'/concluir');toast.success('Entrega registrada.');if(isCurrent())refresh();});
  });
}
export async function renderAccount(_p,_q,isCurrent){
  const user=session.user(),app=document.getElementById('app');
  app.innerHTML=heading('SEU ESPAÇO','Meu perfil','Mantenha seus dados de contato atualizados.')+
    `<section class="card profile-card"><div class="profile-intro"><span class="avatar big">${esc(user.nome.slice(0,1))}</span><div><h2>${esc(user.nome)}</h2><p class="muted">${esc(user.email)}</p>${badge(user.status)}</div></div>
      <form class="stack">${field('nome','Nome completo','text','required minlength="3" maxlength="120"',user.nome)}
      ${field('telefone','Telefone','tel','maxlength="20"',user.telefone||'')}${errorBox}<button class="btn btn-primary" type="submit">Salvar alterações</button></form>
      <a class="text-button" href="#/recuperar">Alterar minha senha</a></section>`;
  formAction(app.querySelector('form'),async data=>{
    await patch('/perfil',data);
    const answer=await authApi.me();session.updateUser(answer.usuario);
    window.dispatchEvent(new CustomEvent('sessao-alterada'));toast.success('Perfil atualizado.');if(isCurrent())refresh();
  });
}
export async function renderNotifications(_p,_q,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Buscando notificações...');
  const notifications=await get('/notificacoes');if(!isCurrent())return;
  app.innerHTML=heading('FIQUE POR DENTRO','Notificações')+`<div class="notifications-list">${notifications.map(n=>`<article class="card notification ${n.lida?'read':''}"><span class="notification-dot"></span><div><p>${esc(n.texto)}</p><time class="small muted">${new Date(n.criado_ms).toLocaleString('pt-BR')}</time></div></article>`).join('')}</div>`+(!notifications.length?empty('Tudo em dia','Os avisos das suas transações aparecerão aqui.'):'');
  if(notifications.some(n=>!n.lida)){try{await post('/notificacoes/lidas');}catch(error){if(isCurrent())toast.error(error.message);}}
}
export async function renderAdminCommerce(params,_query,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Consultando a plataforma...');
  const data=await get('/admin');if(!isCurrent())return;
  const page=params.aba,head={moderacao:'Moderação',financeiro:'Financeiro',regras:'Taxas e regras',logs:'Auditoria'}[page];
  app.innerHTML=heading('ADMINISTRAÇÃO',head||'Supervisão da plataforma','Todas as ações de gestão ficam registradas.');
  if(page==='regras'){
    const r=data.regras;
    app.innerHTML+=`<section class="card profile-card"><h2>Regras das próximas transações</h2><p class="muted">Reservas e compras existentes mantêm as taxas registradas quando foram criadas.</p><form class="stack">
      ${field('conveniencia','Taxa de conveniência (%)','number','required min="0" max="30" step=".01"',r.conveniencia_bp/100)}
      ${field('revenda','Taxa de revenda (%)','number','required min="0" max="30" step=".01"',r.revenda_bp/100)}
      ${field('limite','Acréscimo máximo na revenda (%)','number','required min="0" max="100" step=".01"',r.margem_revenda_bp/100)}
      <label class="check-label"><input type="checkbox" name="moderar" ${r.moderar_revenda?'checked':''}> Exigir aprovação dos anúncios de revenda</label>
      ${errorBox}<button class="btn btn-primary" type="submit">Salvar regras</button></form></section>`;
    formAction(app.querySelector('form'),async d=>{
      if(!await confirmDialog({title:'Atualizar as taxas?',message:'As novas taxas serão aplicadas às próximas reservas.',confirmLabel:'Salvar regras'}))return;
      await patch('/admin/regras',{conveniencia_bp:cents(d.conveniencia),revenda_bp:cents(d.revenda),margem_revenda_bp:cents(d.limite),moderar_revenda:d.moderar==='on'});
      toast.success('Regras atualizadas.');
    });
  }
  if(page==='moderacao'){
    app.innerHTML+=`<section class="card"><h2>Eventos no catálogo</h2><div class="moderation-list">${data.eventos.map(e=>`<article><div><h3>${esc(e.nome)}</h3><span class="muted small">${esc(e.cidade)}</span> ${badge(e.moderacao)}</div><div class="card-actions">
      ${e.moderacao!=='aprovado'?`<button class="btn btn-primary btn-sm" data-moderate="evento" data-id="${e.id}" data-status="aprovado">Aprovar</button>`:''}
      ${e.moderacao!=='rejeitado'?`<button class="btn btn-secondary btn-sm" data-moderate="evento" data-id="${e.id}" data-status="rejeitado">Suspender</button>`:''}</div></article>`).join('')}</div></section>
      <section class="card"><h2>Anúncios de revenda</h2><div class="moderation-list">${data.anuncios.map(a=>`<article><div><h3>${esc(a.evento_nome)} · ${esc(a.setor)}</h3><p class="small muted">${esc(a.vendedor)} · ${money(a.preco_centavos)}</p>${badge(a.status)}</div><div class="card-actions">
      ${['pendente','reprovado'].includes(a.status)?`<button class="btn btn-primary btn-sm" data-moderate="anuncio" data-id="${a.id}" data-status="aprovado">Aprovar</button>`:''}
      ${['pendente','publicado'].includes(a.status)?`<button class="btn btn-secondary btn-sm" data-moderate="anuncio" data-id="${a.id}" data-status="rejeitado">Reprovar</button>`:''}</div></article>`).join('')||'<p class="muted">Nenhum anúncio.</p>'}</div></section>`;
    app.querySelectorAll('[data-moderate]').forEach(button=>button.onclick=async()=>{
      if(!await confirmDialog({title:'Confirmar moderação?',message:'O status será atualizado na plataforma e a decisão será registrada.',confirmLabel:'Confirmar decisão'}))return;
      busy(button,async()=>{await post('/admin/'+(button.dataset.moderate==='evento'?'eventos':'anuncios')+'/'+button.dataset.id+'/moderar',{status:button.dataset.status});toast.success('Moderação registrada.');if(isCurrent())refresh();});
    });
  }
  if(page==='financeiro'){
    const active=data.pedidos.filter(p=>p.status!=='estornado'),settled=active.filter(p=>p.status==='repassado');
    app.innerHTML+=`<div class="stats-grid">${stat('Volume ativo',money(active.reduce((s,p)=>s+p.total_centavos,0)))}${stat('Comissões realizadas',money(settled.reduce((s,p)=>s+p.taxa_centavos,0)))}${stat('Valores retidos',money(active.filter(p=>p.status!=='repassado').reduce((s,p)=>s+p.total_centavos,0)))}${stat('Disputas abertas',active.filter(p=>p.status==='contestado').length)}</div><div class="orders-list">
      ${data.pedidos.map(p=>`<article class="card order-card"><div><p class="small muted">${esc(p.id.slice(0,8))} · ${p.tipo==='primario'?'Oficial':'Revenda'}</p><h2>${esc(p.evento_nome)}</h2><p class="muted small">${esc(p.comprador)} · Total ${money(p.total_centavos)} · Taxa ${money(p.taxa_centavos)}</p>${p.motivo?`<p>Contestação: ${esc(p.motivo)}</p>`:''}</div><div class="order-values">${badge(p.status)}<strong>Líquido ${money(p.liquido_centavos)}</strong><div class="card-actions">
      ${p.status==='retido' && Date.parse(p.data_fim.replace(' ','T')+'-03:00')<Date.now()?`<button class="btn btn-primary btn-sm" data-resolve="repassar" data-id="${p.id}">Repassar</button>`:''}
      ${['retido','contestado'].includes(p.status)?`<button class="btn btn-secondary btn-sm" data-resolve="estornar" data-id="${p.id}">Estornar</button>`:''}
      ${p.status==='contestado'?`<button class="btn btn-secondary btn-sm" data-resolve="liberar" data-id="${p.id}">Resolver disputa</button>`:''}</div></div></article>`).join('')||empty('Nenhuma transação ainda')}</div>`;
    app.querySelectorAll('[data-resolve]').forEach(button=>button.onclick=async()=>{
      const {resolve:action,id}=button.dataset;
      if(action==='liberar'){
        const {element,close}=openModal('Resolver disputa',`<p>Informe por que a contestação será encerrada e o valor voltará ao estado retido.</p><form class="stack"><label class="field">Justificativa<textarea required minlength="8" maxlength="500" name="motivo"></textarea></label>${errorBox}<button class="btn btn-primary" type="submit">Registrar resolução</button></form>`);
        formAction(element.querySelector('form'),async body=>{await post('/admin/pedidos/'+id+'/resolver',{acao:action,...body});close();toast.success('Disputa resolvida.');if(isCurrent())refresh();});
        return;
      }
      if(!await confirmDialog({title:action==='repassar'?'Confirmar repasse?':'Confirmar estorno integral?',message:'A operação financeira simulada será registrada no histórico.',confirmLabel:'Confirmar',danger:action==='estornar'}))return;
      busy(button,async()=>{await post('/admin/pedidos/'+id+'/resolver',{acao:action});toast.success('Operação registrada.');if(isCurrent())refresh();});
    });
  }
  if(page==='logs')app.innerHTML+=`<section class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Recurso</th><th>Detalhe</th></tr></thead><tbody>${data.logs.map(l=>`<tr><td>${new Date(l.criado_ms).toLocaleString('pt-BR')}</td><td>${esc(l.usuario||'Sistema')}</td><td>${esc(l.acao)}</td><td class="small mono">${esc(l.recurso)}</td><td>${esc(l.detalhe)}</td></tr>`).join('')||'<tr><td colspan="5">Nenhuma ação registrada.</td></tr>'}</tbody></table></div></section>`;
}
