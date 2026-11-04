import { get,reserve } from '../api/commerce.api.js';
import { session } from '../session.js';
import { esc,money,date,heading,empty,formAction } from '../components/ui.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { renderLoading } from '../components/state-view.js';
const arts=['sunset','indie','jazz','campus'];
export const art=name=>'assets/'+(arts.includes(name)?name:'sunset')+'.svg';
const eventCard=e=>`<article class="event-card"><a href="#/explorar/${e.id}" class="event-art"><img src="${art(e.arte)}" alt="Cartaz de ${esc(e.nome)}" loading="lazy">
  <span class="art-tag">${esc(e.categoria)}</span><span class="event-arrow">↗</span></a>
  <div class="event-card-body"><p class="date-kicker">${esc(date(e.data_inicio))}</p><h3><a href="#/explorar/${e.id}">${esc(e.nome)}</a></h3>
  <p class="event-location">${esc(e.local_evento)}</p><div class="availability">${e.primarios?'<span>● Oficial</span>':''}${e.secundarios?'<span class="p2p-tag">↻ Revenda entre fãs</span>':''}</div>
  <div class="event-price"><span class="muted small">A partir de</span><strong>${e.a_partir===null?'Esgotado':money(e.a_partir)}</strong></div></div></article>`;
export async function renderMarketplace(_params,query,isCurrent){
  const app=document.getElementById('app');
  app.innerHTML=renderLoading('Encontrando seu próximo evento...');
  const [events,options]=await Promise.all([get('/catalogo',query),get('/opcoes-catalogo')]);
  if(!isCurrent())return;
  const filtered=Object.values(query).some(Boolean);
  app.innerHTML=`${!filtered?`<section class="hero" aria-roledescription="carrossel"><div class="hero-copy">
    <p class="eyebrow"><span class="live-dot"></span> VIVA O QUE TE MOVE</p>
    <h1>O próximo<br>encontro é<br><em>inesquecível.</em></h1>
    <p>Música, cultura e conexões de verdade.<br>Encontre seu lugar na próxima história.</p>
    <a class="btn btn-lime" data-hero-link href="#/explorar/${events[0]?.id||''}">Quero estar lá <span>↗</span></a>
    <div class="hero-controls"><button aria-label="Destaque anterior" data-prev>←</button><span data-slide-count>01 / ${String(events.length).padStart(2,'0')}</span><button aria-label="Próximo destaque" data-next>→</button></div>
  </div><div class="hero-art"><img src="${art(events[0]?.arte)}" alt="${esc(events[0]?.nome||'Arte de eventos')}" data-hero-img>
    <div class="hero-caption"><div><span class="eyebrow">EM DESTAQUE</span><strong data-hero-title>${esc(events[0]?.nome||'Explore os eventos')}</strong></div><span class="hero-sparkle">✦</span></div></div></section>
    <section class="trust-strip"><span>◎ <b>Ingressos oficiais</b></span><span>↻ <b>Revenda entre fãs</b></span><span>◇ <b>Compra acompanhada</b></span><span>✦ <b>Novas experiências</b></span></section>`:''}
    <section class="discovery"><div class="section-heading"><div><p class="eyebrow">A CIDADE ACONTECE AQUI</p><h2>${filtered?'Encontre o seu evento':'Escolha a sua próxima história'}</h2></div><span class="muted">${events.length} eventos encontrados</span></div>
      <form class="filter-bar" id="market-filters" aria-label="Filtros de eventos">
        <label class="filter-search"><span>Buscar evento</span><input type="search" name="q" placeholder="Festival, show, encontro..." value="${esc(query.q||'')}"></label>
        <label><span>Cidade</span><select name="cidade"><option value="">Todas as cidades</option>${[...new Set(options.map(o=>o.cidade))].sort().map(v=>`<option ${query.cidade===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
        <label><span>A partir de</span><input type="date" name="data" value="${esc(query.data||'')}"></label>
        <label><span>Preço máximo (R$)</span><input type="number" name="max" min="1" placeholder="Sem limite" value="${esc(query.max||'')}"></label>
        <input type="hidden" name="categoria" value="${esc(query.categoria||'')}">
        <button class="btn btn-primary" type="submit">Filtrar</button>
      </form>
      <div class="category-tabs">${['','Eletrônica','Indie & Rock','Jazz & Blues','Universitário','Sertanejo','Pop','Cultura','Outros'].map(v=>`<button class="category-chip ${(query.categoria||'')===v?'active':''}" data-category="${esc(v)}">${esc(v||'Todos os ritmos')}</button>`).join('')}</div>
      <div class="event-grid">${events.map(eventCard).join('')}</div>
      ${!events.length?empty('Nenhum encontro por aqui ainda','Experimente outra cidade, data ou faixa de preço.','<a class="btn btn-secondary" href="#/">Limpar filtros</a>'):''}
    </section><section class="organizer-banner"><div><p class="eyebrow">DO PLANEJAMENTO AO ÚLTIMO APLAUSO</p><h2>Seu evento merece<br>acontecer.</h2><p>Organize, encontre fornecedores e acompanhe suas vendas em um só lugar.</p></div><a class="btn btn-white" href="#/cadastro">Começar meu evento ↗</a></section>`;
  const form=app.querySelector('#market-filters');
  formAction(form,data=>navigate('/',Object.fromEntries(Object.entries(data).filter(([,v])=>v))));
  app.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{
    form.elements.categoria.value=button.dataset.category;
    form.requestSubmit();
  });
  if(!filtered && events.length){
    let current=0;
    const show=delta=>{
      current=(current+delta+events.length)%events.length;const e=events[current];
      app.querySelector('[data-hero-img]').src=art(e.arte);app.querySelector('[data-hero-img]').alt=e.nome;
      app.querySelector('[data-hero-title]').textContent=e.nome;
      app.querySelector('[data-hero-link]').href='#/explorar/'+e.id;
      app.querySelector('[data-slide-count]').textContent=String(current+1).padStart(2,'0')+' / '+String(events.length).padStart(2,'0');
    };
    app.querySelector('[data-prev]').onclick=()=>show(-1);app.querySelector('[data-next]').onclick=()=>show(1);
  }
}
export async function renderPublicEvent({id},_query,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Carregando evento e ingressos...');
  const {evento:e,lotes,anuncios,regras}=await get('/catalogo/'+id);
  if(!isCurrent())return;
  app.innerHTML=`<p class="breadcrumb"><a href="#/">Explorar eventos</a> / ${esc(e.nome)}</p>
    <section class="public-event-cover"><img src="${art(e.arte)}" alt="Cartaz de ${esc(e.nome)}"></section>
    <div class="event-detail-layout"><article>
      <p class="eyebrow">${esc(e.categoria)} · ${esc(e.cidade)}</p><h1>${esc(e.nome)}</h1>
      <div class="event-facts"><div><span>QUANDO</span><strong>${esc(date(e.data_inicio))}</strong></div><div><span>ONDE</span><strong>${esc(e.local_evento)}</strong></div></div>
      <h2>Um encontro para lembrar</h2><p class="event-description">${esc(e.descricao||'Uma experiência para compartilhar com quem importa.')}</p>
      <div class="info-panel"><span class="empty-symbol">↻</span><div><h3>Mudou de planos?</h3><p>Compre e coloque seu ingresso em revenda pela sua carteira. O limite de acréscimo atual é ${regras.margem_revenda_bp/100}%.</p></div></div>
      <h3>Antes de participar</h3><p class="muted">Confira as regras do organizador e mantenha seu código de acesso privado. A transferência pela plataforma gera um novo código para o comprador.</p>
      <a href="#/cadastro" class="text-button">Criar minha conta para acompanhar o evento ↗</a>
    </article><aside class="ticket-selection card"><p class="eyebrow">GARANTA SEU LUGAR</p><h2>Escolha seu ingresso</h2>
      <div class="selection-tabs"><button class="active" data-source="official">Oficiais</button><button data-source="resale">Revenda ${anuncios.length?'('+anuncios.length+')':''}</button></div>
      <div id="ticket-options"></div><div class="checkout-safety">◇ Reserva por 10 minutos · Pagamento simulado</div>
    </aside></div>`;
  const slot=app.querySelector('#ticket-options');
  const display=source=>{
    app.querySelectorAll('[data-source]').forEach(b=>b.classList.toggle('active',b.dataset.source===source));
    const official=source==='official';
    const available=official?lotes.filter(l=>l.ativo):anuncios;
    slot.innerHTML=available.length?available.map(l=>`<form class="ticket-option" data-id="${esc(l.id)}">
      <div><span class="small muted">${official?'INGRESSO OFICIAL':'REVENDA ENTRE FÃS'}</span><h3>${esc(l.setor)}</h3>
      <p class="small muted">${official?esc(l.nome)+' · '+l.disponiveis+' disponíveis':'Vendido por '+esc(l.vendedor)}</p></div>
      <strong>${money(official?l.valor_centavos:l.preco_centavos)}</strong>
      ${official?`<label class="field small">Quantidade<select name="quantidade">${Array.from({length:Math.min(6,l.disponiveis)},(_,i)=>`<option>${i+1}</option>`).join('')}</select></label>`:'<input name="quantidade" type="hidden" value="1">'}
      <button class="btn btn-primary" type="submit" ${official && !l.disponiveis?'disabled':''}>${official&&!l.disponiveis?'Esgotado':'Selecionar ingresso'}</button>
      ${official && regras.conveniencia_bp?`<span class="small muted">+ ${regras.conveniencia_bp/100}% de conveniência</span>`:''}</form>`).join(''):empty('Nenhum ingresso disponível',official?'Confira as opções de revenda.':'Novos anúncios podem aparecer em breve.');
    slot.querySelectorAll('form').forEach(form=>formAction(form,async data=>{
      if(session.user() && session.user().perfil!=='comprador'){
        toast.info('Entre com uma conta de comprador para adquirir ingressos.');return;
      }
      const r=await reserve({[official?'lote_id':'anuncio_id']:form.dataset.id,quantidade:Number(data.quantidade)});
      localStorage.setItem('trocaticket.carrinho',r.id);
      if(isCurrent())navigate('/checkout/'+r.id);
    }));
  };
  app.querySelectorAll('[data-source]').forEach(button=>button.onclick=()=>display(button.dataset.source));
  display('official');
}
export async function renderServiceDirectory(params,_query,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Buscando fornecedores...');
  const result=params.id?await get('/fornecedores/'+params.id):null;
  const services=result?result.servicos:await get('/servicos');
  if(!isCurrent())return;
  app.innerHTML=heading('CONEXÕES QUE FAZEM ACONTECER',result?.fornecedor?.razao_social||'Encontre o time do seu evento','Serviços de fornecedores aprovados para transformar sua ideia em experiência.')+
    `<div class="service-grid">${services.map(s=>`<article class="card service-card"><span class="service-symbol">✦</span><p class="eyebrow">${esc(s.categoria)}</p><h2>${esc(s.titulo)}</h2>
    <p>${esc(s.descricao)}</p><p class="muted small">${esc(s.razao_social||s.nome||result?.fornecedor?.nome||'Fornecedor aprovado')}</p><strong>A partir de ${money(s.valor_centavos)}</strong>
    <div class="card-actions">${s.portfolio_url?`<a href="${esc(s.portfolio_url)}" target="_blank" rel="noopener noreferrer" class="text-button">Ver portfólio ↗</a>`:''}
    <a class="text-button" href="#/fornecedores/${s.fornecedor_id}">Perfil público</a>
    <a class="btn btn-secondary btn-sm" href="#/eventos">Solicitar cotação em um evento</a></div></article>`).join('')}</div>`+
    (!services.length?empty('Serviços em preparação','Os fornecedores aprovados poderão publicar seus serviços aqui.'):'');
}
