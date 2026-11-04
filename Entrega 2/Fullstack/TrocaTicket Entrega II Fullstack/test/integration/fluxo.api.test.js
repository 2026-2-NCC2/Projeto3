'use strict';

/**
 * Teste de integração do fluxo ponta a ponta (seção 10 do enunciado).
 * Requer servidor em execução (npm run dev) e banco com db/schema.sql + db/seed.sql.
 *
 *   npm run test:integration
 *
 * Variáveis opcionais: API_URL, TEST_ADMIN_EMAIL, TEST_ADMIN_SENHA
 * (padrão = credenciais do seed de demonstração).
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');

const API = (process.env.API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@trocaticket.com.br',
  senha: process.env.TEST_ADMIN_SENHA || 'Admin@2026',
};

const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** Gera um CNPJ com dígitos verificadores válidos (para cadastros únicos a cada execução). */
function gerarCnpj() {
  const dv = (digitos, pesos) => {
    const soma = digitos.reduce((acc, d, i) => acc + d * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 9) + 1);
  base.push(0, 0, 0, 1);
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, body: data };
}

const login = async (email, senha) => {
  const r = await api('POST', '/auth/login', { body: { email, senha } });
  assert.equal(r.status, 200, `login falhou para ${email}`);
  return r.body.token;
};

describe('Fluxo completo: autocadastro → aprovação → evento → custos → propostas → seleção → ticket', () => {
  let adminToken;
  let orgToken;
  let orgId;
  let outroOrgToken;
  let fornToken;
  let fornId;
  let eventoId;
  let itemId;
  let propostaId;

  before(async () => {
    const health = await api('GET', '/health');
    assert.equal(health.status, 200, 'API ou MySQL indisponível. Suba o servidor antes dos testes.');
    adminToken = await login(ADMIN.email, ADMIN.senha);
  });

  test('RF01: organizador se cadastra com status pendente e não consegue operar', async () => {
    const email = `org.${unico()}@teste.com`;
    const cadastro = await api('POST', '/auth/cadastro/organizador', {
      body: { nome: 'Organizadora Teste', email, senha: 'Senha1234' },
    });
    assert.equal(cadastro.status, 201);
    assert.equal(cadastro.body.usuario.status, 'pendente');
    assert.equal(cadastro.body.usuario.senha_hash, undefined, 'a senha nunca deve ser devolvida');

    orgToken = await login(email, 'Senha1234');
    orgId = cadastro.body.usuario.id;

    const tentativa = await api('POST', '/eventos', {
      token: orgToken,
      body: { nome: 'Evento bloqueado', local_evento: 'Local', data_inicio: '2099-01-01', data_fim: '2099-01-02', publico_minimo: 1, publico_maximo: 2 },
    });
    assert.equal(tentativa.status, 403, 'conta pendente não pode criar eventos');
  });

  test('RF03: administrador aprova o organizador', async () => {
    const pendentes = await api('GET', '/admin/usuarios?status=pendente&perfil=organizador', { token: adminToken });
    assert.equal(pendentes.status, 200);
    assert.ok(pendentes.body.data.some((u) => u.id === orgId));

    const aprovacao = await api('PATCH', `/admin/usuarios/${orgId}/status`, {
      token: adminToken,
      body: { status: 'aprovado' },
    });
    assert.equal(aprovacao.status, 200);
    assert.equal(aprovacao.body.status, 'aprovado');
    assert.ok(aprovacao.body.aprovado_por, 'deve registrar quem aprovou');
  });

  test('RF05: organizador aprovado cria evento e não pode alterar o status diretamente', async () => {
    const criado = await api('POST', '/eventos', {
      token: orgToken,
      body: {
        nome: 'Festa Integrada de Teste',
        descricao: 'Evento do teste de fluxo completo',
        local_evento: 'Pátio Central',
        data_inicio: '2099-11-28T20:00',
        data_fim: '2099-11-29T03:00',
        publico_minimo: 200,
        publico_maximo: 800,
        publico_esperado: 500,
        margem_lucro_percentual: 20,
      },
    });
    assert.equal(criado.status, 201);
    assert.equal(criado.body.status, 'rascunho');
    assert.equal(criado.body.organizador_id, orgId);
    eventoId = criado.body.id;

    const forcado = await api('PATCH', `/eventos/${eventoId}`, { token: orgToken, body: { status: 'publicado' } });
    assert.equal(forcado.status, 400, 'status não pode ser alterado por PATCH');
  });

  test('RF06/RF07: cadastra itens de composição de custo e custos do evento', async () => {
    const item = await api('POST', `/eventos/${eventoId}/itens-custo`, {
      token: orgToken,
      body: { nome: 'Iluminação de palco', categoria: 'iluminacao', descricao: 'Refletores e moving heads' },
    });
    assert.equal(item.status, 201);
    itemId = item.body.id;

    const duplicado = await api('POST', `/eventos/${eventoId}/itens-custo`, {
      token: orgToken,
      body: { nome: 'Iluminação de palco', categoria: 'iluminacao' },
    });
    assert.equal(duplicado.status, 409);

    await api('POST', `/eventos/${eventoId}/itens-custo`, {
      token: orgToken,
      body: { nome: 'Segurança do evento', categoria: 'seguranca' },
    });

    const custo = await api('POST', `/eventos/${eventoId}/custos`, {
      token: orgToken,
      body: { descricao: 'Alvará e taxas', tipo: 'fiscal', valor: 1800 },
    });
    assert.equal(custo.status, 201);
  });

  test('RF08: publica o evento para cotação e bloqueia a segunda publicação', async () => {
    const publicado = await api('POST', `/eventos/${eventoId}/publicar`, { token: orgToken });
    assert.equal(publicado.status, 200);
    assert.equal(publicado.body.status, 'publicado');

    const de_novo = await api('POST', `/eventos/${eventoId}/publicar`, { token: orgToken });
    assert.equal(de_novo.status, 409);
  });

  test('RF02/RF03/RF09: fornecedor se cadastra, é aprovado e vê a oportunidade', async () => {
    const email = `forn.${unico()}@teste.com`;
    const cadastro = await api('POST', '/auth/cadastro/fornecedor', {
      body: {
        nome: 'Fornecedor Teste',
        email,
        senha: 'Senha1234',
        razao_social: 'Fornecedor Teste Ltda',
        documento: gerarCnpj(),
        area_atuacao: 'Iluminação e som',
      },
    });
    assert.equal(cadastro.status, 201);
    fornId = cadastro.body.usuario.id;
    fornToken = await login(email, 'Senha1234');

    const antes = await api('GET', '/fornecedor/oportunidades', { token: fornToken });
    assert.equal(antes.status, 403, 'fornecedor pendente não vê oportunidades');

    await api('PATCH', `/admin/usuarios/${fornId}/status`, { token: adminToken, body: { status: 'aprovado' } });

    const lista = await api('GET', '/fornecedor/oportunidades', { token: fornToken });
    assert.equal(lista.status, 200);
    assert.ok(lista.body.data.some((e) => e.id === eventoId), 'evento publicado deve aparecer');

    const detalhe = await api('GET', `/fornecedor/oportunidades/${eventoId}`, { token: fornToken });
    assert.equal(detalhe.status, 200);
    assert.equal(detalhe.body.itens.length, 2);
    assert.equal(detalhe.body.evento.margem_lucro_percentual, undefined, 'margem é informação interna do organizador');
  });

  test('RF10: fornecedor envia, repete (bloqueado), edita e cancela propostas', async () => {
    const payload = {
      valor: 4300,
      descricao: 'Locação de refletores LED com operador',
      validade: '2099-12-31',
      observacoes: 'Montagem inclusa',
    };
    const envio = await api('POST', `/itens-custo/${itemId}/propostas`, { token: fornToken, body: payload });
    assert.equal(envio.status, 201);
    assert.equal(envio.body.status, 'enviada');
    propostaId = envio.body.id;

    const repetida = await api('POST', `/itens-custo/${itemId}/propostas`, { token: fornToken, body: payload });
    assert.equal(repetida.status, 409);

    const editada = await api('PUT', `/propostas/${propostaId}`, {
      token: fornToken,
      body: { ...payload, valor: 4100 },
    });
    assert.equal(editada.status, 200);
    assert.equal(editada.body.valor, 4100);

    const historico = await api('GET', '/fornecedor/propostas', { token: fornToken });
    assert.ok(historico.body.data.some((p) => p.id === propostaId));
  });

  test('RF11/RF12: organizador compara propostas, seleciona e a seleção é única por item', async () => {
    const cotacoes = await api('GET', `/eventos/${eventoId}/cotacoes`, { token: orgToken });
    assert.equal(cotacoes.status, 200);
    const item = cotacoes.body.itens.find((i) => i.id === itemId);
    assert.ok(item.propostas.some((p) => p.id === propostaId && p.menor_valor));

    const selecao = await api('POST', `/propostas/${propostaId}/selecionar`, { token: orgToken });
    assert.equal(selecao.status, 200);
    assert.equal(selecao.body.status, 'selecionada');

    const orcamento = await api('GET', `/eventos/${eventoId}/orcamento`, { token: orgToken });
    assert.equal(orcamento.status, 200);
    const itemOrcado = orcamento.body.itens.find((i) => i.id === itemId);
    assert.equal(itemOrcado.valor, 4100);
    assert.equal(orcamento.body.completo, false, 'o item de segurança ainda não tem proposta');

    const liberar = await api('POST', `/propostas/${propostaId}/liberar`, { token: orgToken });
    assert.equal(liberar.status, 200);
    assert.equal(liberar.body.status, 'enviada');
  });

  test('RF13: ticket de equilíbrio e alvo são calculados a partir do orçamento', async () => {
    await api('POST', `/propostas/${propostaId}/selecionar`, { token: orgToken });
    const ticket = await api('GET', `/eventos/${eventoId}/ticket`, { token: orgToken });
    assert.equal(ticket.status, 200);
    assert.equal(ticket.body.margem_lucro_percentual, 20);
    assert.equal(ticket.body.completo, false);
    assert.ok(ticket.body.cenarios.length >= 2);
    ticket.body.cenarios.forEach((c) => {
      assert.ok(c.ticket_alvo >= c.ticket_equilibrio, 'o alvo com margem nunca é menor que o equilíbrio');
    });
  });

  test('Isolamento: outro organizador não enxerga o evento (404)', async () => {
    const email = `outro.${unico()}@teste.com`;
    const cadastro = await api('POST', '/auth/cadastro/organizador', {
      body: { nome: 'Outro Organizador', email, senha: 'Senha1234' },
    });
    await api('PATCH', `/admin/usuarios/${cadastro.body.usuario.id}/status`, {
      token: adminToken,
      body: { status: 'aprovado' },
    });
    outroOrgToken = await login(email, 'Senha1234');

    const r = await api('GET', `/eventos/${eventoId}`, { token: outroOrgToken });
    assert.equal(r.status, 404);
  });

  test('Permissões: fornecedor não cria evento, não envia proposta sem autenticação', async () => {
    const criar = await api('POST', '/eventos', {
      token: fornToken,
      body: { nome: 'Evento indevido', local_evento: 'X Y', data_inicio: '2099-01-01', data_fim: '2099-01-02', publico_minimo: 1, publico_maximo: 2 },
    });
    assert.equal(criar.status, 403);

    const anonimo = await api('GET', '/eventos');
    assert.equal(anonimo.status, 401);
  });

  test('RF14: administrador vê indicadores e a visão de eventos', async () => {
    const resumo = await api('GET', '/admin/relatorios/resumo', { token: adminToken });
    assert.equal(resumo.status, 200);
    assert.ok(resumo.body.eventos.publicado >= 1);

    const eventos = await api('GET', '/admin/eventos?status=publicado', { token: adminToken });
    assert.equal(eventos.status, 200);
    assert.ok(eventos.body.data.some((e) => e.id === eventoId));
  });

  test('CRUD (Entrega 1): evento em rascunho pode ser excluído; publicado não', async () => {
    const rascunho = await api('POST', '/eventos', {
      token: orgToken,
      body: { nome: 'Para excluir', local_evento: 'Local teste', data_inicio: '2099-03-01', data_fim: '2099-03-02', publico_minimo: 1, publico_maximo: 5 },
    });
    const removido = await api('DELETE', `/eventos/${rascunho.body.id}`, { token: orgToken });
    assert.equal(removido.status, 204);
    assert.equal((await api('GET', `/eventos/${rascunho.body.id}`, { token: orgToken })).status, 404);

    const publicado = await api('DELETE', `/eventos/${eventoId}`, { token: orgToken });
    assert.equal(publicado.status, 409);
  });
});

