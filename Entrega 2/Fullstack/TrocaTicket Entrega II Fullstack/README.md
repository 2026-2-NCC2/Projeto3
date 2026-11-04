# TrocaTicket · Versão 3

Marketplace de ingressos oficiais e de revenda, gestão de eventos, cotações e serviços. SPA em HTML, CSS e JavaScript, com API Express, MySQL e modo de apresentação com SQLite persistente.

## Abrir no Windows

1. Instale **Node.js 24 LTS**, extraia o ZIP inteiro e abra **APRESENTAR.bat**.
2. Quando o terminal informar que está pronto, acesse **http://127.0.0.1:3000**.
3. Mantenha a janela aberta. Em **Entrar → Acessos para apresentar**, escolha Comprador, Organizador, Fornecedor ou Administrador.
4. Pelo terminal, execute **npm run apresentacao**. O pacote inclui as dependências JavaScript. Ao usar somente o código-fonte, execute **npm ci** antes.

O banco é criado e preenchido automaticamente em **.dados/apresentacao.sqlite**. A chave de assinatura fica ao lado dele, preservando as sessões entre reinicializações. Os dados ficam no computador. Os acessos rápidos aparecem no modo de apresentação local. O login normal confere o e-mail e a senha cadastrados.

| Conta de exemplo | Senha |
|---|---|
| comprador@demo.com | Demo@2026 |
| revendedor@demo.com | Demo@2026 |
| organizador@demo.com | Demo@2026 |
| fornecedor@demo.com | Demo@2026 |
| admin@trocaticket.com.br | Admin@2026 |

A conta **revendedor@demo.com** tem perfil **comprador**, com ingresso anunciado. A revenda fica dentro da carteira. Novos compradores são aprovados automaticamente. Organizadores e fornecedores aguardam a administração.

Se a porta 3000 estiver ocupada, feche a versão anterior. Para usar outra porta no PowerShell, defina **$env:PORT=3001** antes de executar **npm run apresentacao**.

## Roteiro para apresentar

1. Explore os eventos, use busca, carrossel e filtros. Alterne os temas claro e escuro.
2. Abra **Sunset Festival** e selecione um ingresso oficial. O servidor cria uma reserva de 10 minutos, mesmo sem login.
3. No checkout, clique em **Criar conta**, cadastre um comprador e continue sem perder o carrinho. Escolha PIX ou cartão e confirme o pagamento simulado.
4. Em **Meus ingressos**, abra o QR e use **Revender**. Defina o preço dentro do limite e confirme. O código fica bloqueado durante o anúncio.
5. Entre como administrador e abra **Moderação** para aprovar o anúncio. Em outro navegador ou janela anônima, entre com outro comprador e compre na aba **Revenda** da página do evento.
6. Mostre o novo titular, o novo código e o status da venda na carteira do vendedor. A taxa de revenda começa em **1,5%**. A administração só pode concluir o repasse depois que o evento terminar.
7. No Organizador, abra **Meus eventos → evento → Vendas, lotes e check-in**. Gerencie lotes, categoria, cidade, publicação e validação do código.
8. Em **Planejamento e custos**, demonstre itens, custos, cotações, seleção de propostas e estimativa de ticket para três públicos.
9. No Fornecedor, abra **Oportunidades**, envie uma cotação e acompanhe **Minhas propostas**. Publique **Meus serviços** e consulte **Contratos**. Uma proposta selecionada pelo organizador aparece como entrega ativa.
10. Na administração, mostre **Usuários**, **Moderação**, **Financeiro**, **Taxas e regras** e **Auditoria**.
11. Em **Esqueci minha senha**, solicite um código. A apresentação mostra a caixa de e-mail simulada. Redefina a senha e entre novamente.

## Regras financeiras

- No ingresso oficial, a conveniência padrão de 1,5% é adicionada ao valor pago pelo comprador.
- Na revenda, 1,5% é deduzido do vendedor. Exemplo de R$ 120,00 pagos, R$ 1,80 de taxa e R$ 118,20 líquidos.
- A administração configura ambas as taxas e o acréscimo máximo de revenda, inicialmente 20% sobre o valor original.
- A reserva guarda o preço e as taxas de sua criação. Mudanças afetam reservas futuras.
- O estoque considera vendas e reservas válidas. As escritas financeiras usam bloqueio e transação.
- Repetir um pagamento retorna o pedido já existente. A reserva só gera uma compra.
- Cada anúncio deriva de ingresso adquirido e pertencente ao comprador. A compra secundária troca a titularidade e o código.
- É possível cancelar anúncio sem reserva ativa. Ingressos utilizados, vencidos ou em disputa ficam impedidos de nova revenda.
- O comprador de uma revenda também pode anunciar o ingresso novamente, mantendo o histórico de titulares. Um ingresso só pode ter um anúncio ativo.
- O comprador pode contestar uma compra retida. A administração estorna integralmente ou encerra a disputa com justificativa.
- O estorno secundário devolve o ingresso ao vendedor anterior e renova o código. Em uma cadeia de revendas, resolva primeiro a transação mais recente. Para estornar uma compra primária com ingresso transferido, resolva primeiro a revenda.
- Cancelar um evento estorna primeiro as compras secundárias e depois as primárias, invalida os ingressos e encerra as reservas. Eventos com repasse concluído exigem resolução individual da administração.

## MySQL e Docker

Em instalação limpa, com Docker Desktop aberto:

```powershell
docker compose up --build -d
docker compose logs app db
```

Abra http://127.0.0.1:3000. O Compose importa o esquema e as contas acadêmicas ao criar o volume. No modo MySQL, o login usa as credenciais normais. Para acrescentar o catálogo de demonstração na primeira instalação:

```powershell
docker compose exec -e SEED_COMMERCE_DEMO=1 app node -e "require('./src/commerce/init').initialize().then(()=>require('./src/db').close()).catch(e=>{console.error(e.message);process.exit(1)})"
```

Sem Docker, copie **.env.example** para **.env**, configure as credenciais e use um usuário MySQL com permissão para criar e alterar o esquema:

```bash
npm ci
npm run db:init
npm run criar-admin
npm start
```

O banco acadêmico se chama **trocaticket**. Defina **ADMIN_EMAIL** e **ADMIN_SENHA** antes de criar o administrador. Para carregar exemplos em um banco limpo, execute **npm run db:init -- --demo**.

Em atualização anterior, faça backup do banco e execute **npm run db:init**. O esquema passa a aceitar compradores e recebe as tabelas de comércio. O endpoint antigo **/api/revendas** responde 410 e orienta o uso de **/api/commerce/anuncios**.

Para migrar a apresentação anterior, copie a pasta **.dados** para a pasta nova antes de iniciar. O sistema cria as tabelas novas e converte o perfil antigo de revendedor em comprador. Anúncios antigos baseados em código digitado ficam na tabela histórica anterior. O fluxo novo exige um ingresso da carteira.

## Recuperação por e-mail

Na apresentação, a interface exibe o código de teste. Para envio real em MySQL, configure as credenciais SMTP:

```env
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=conta@seudominio.com
SMTP_PASSWORD=senha-ou-token-do-provedor
SMTP_FROM=TrocaTicket <conta@seudominio.com>
```

O código expira em 10 minutos, permite cinco tentativas e funciona uma vez. Há intervalo de um minuto entre solicitações por e-mail. A senha é armazenada com scrypt e sua redefinição invalida as sessões anteriores.

## Arquitetura e API

- **public/js/router.js** centraliza as rotas, captura falhas e descarta renderizações atrasadas.
- **public/js/components/** reúne navegação, autenticação em modal, carteira, feedback e confirmação.
- **public/js/pages/** organiza marketplace, checkout, gestão e planejamento acadêmico.
- **public/js/api/http.js** concentra fetch, token, timeout e erros. Uma resposta 401 pede renovação mantendo a rota e o carrinho. Falhas 403 e 500 exibem mensagens.
- **src/commerce/** organiza reservas, compras, ingressos, moderação, contratos, regras, notificações, recuperação e auditoria.
- **src/services**, **src/controllers**, **src/repositories** e **src/validators** preservam planejamento e cotações.
- **db/schema.sql** cria o esquema acadêmico MySQL, e **db/commerce.sql** acrescenta o comércio. **db/demo-schema.sql** e **src/db-demo.js** sustentam o SQLite de apresentação.

O QR é gerado no servidor, acessível ao titular e rotacionado na transferência. O check-in só é registrado uma vez. Valores financeiros usam centavos inteiros.

| Método | Rota a partir de /api/commerce | Acesso |
|---|---|---|
| GET | /catalogo, /catalogo/:id, /regras, /servicos | Público |
| POST | /reservas | Visitante com identificador do navegador |
| GET, DELETE | /reservas/:id | Mesmo navegador, header X-Visitante |
| POST | /pagar | Comprador aprovado |
| GET | /carteira, /pedidos, /ingressos/:id/qr | Titular |
| POST | /anuncios, /pedidos/:id/contestar | Comprador |
| DELETE | /anuncios/:id | Vendedor titular |
| POST | /recuperar-senha, /redefinir-senha | Público |
| PATCH | /perfil | Autenticado |
| GET | /notificacoes | Autenticado |
| POST | /notificacoes/lidas | Autenticado |
| GET | /gestao/eventos/:id | Organizador dono ou administrador |
| POST | /gestao/eventos/:id/catalogo, /lotes, /checkin, /cancelar | Organizador dono ou administrador, sufixos sob a mesma rota do evento |
| GET, POST | /gestao/servicos | Fornecedor |
| GET | /gestao/contratos | Fornecedor |
| POST | /gestao/contratos/:id/concluir | Fornecedor dono |
| GET | /admin | Administrador |
| PATCH | /admin/regras | Administrador |
| POST | /admin/eventos/:id/moderar, /admin/anuncios/:id/moderar | Administrador |
| POST | /admin/pedidos/:id/resolver | Administrador |

A coleção em **postman/** mantém o CRUD acadêmico e acrescenta o comércio.

## Testes

```bash
npm test
npm run test:unit
npm run test:integration
```

**npm test** cria um banco SQLite temporário, inicia a API, executa a suíte e verifica a sessão após reiniciar o processo. O teste remove os arquivos temporários ao terminar. **test:integration** requer API já em execução.

A suíte cobre cadastro, aprovação, isolamento, CRUD, propostas, orçamento, estoque concorrente, expiração, taxas preservadas, pagamento idempotente, limite de revenda, troca de QR, estorno e OTP. Foram exercitados também o MySQL 8.0.46 e os fluxos em Chromium com resolução desktop e mobile.

## Escopo da apresentação

PIX, cartão, retenção, repasse e estorno são simulados com registros reais no banco. O QR PIX identifica a simulação. O check-in recebe leitura de dispositivo que digita o código ou colagem manual. O portfólio usa links HTTPS.

O planejamento, a cotação e o cálculo do ticket da Entrega 2 continuam disponíveis. A estimativa de preço usa a fórmula acadêmica de custo e margem. O envio de e-mail real depende da configuração SMTP. O BAT requer Node.js 24 no Windows.
