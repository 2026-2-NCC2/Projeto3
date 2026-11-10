# 🗄️ Documentação e Modelagem do Banco de Dados — TrocaTicket

Este diretório armazena os scripts de criação, a modelagem relacional e o dicionário de dados completo da plataforma **TrocaTicket** (Projeto Interdisciplinar — 2º Semestre de Ciência da Computação — FECAP).

O banco de dados foi estruturado em **PostgreSQL** (compatível com **Supabase**), utilizando transações seguras, tipos enumerados (`ENUM`), restrições de verificação (`CHECK`), colunas geradas (`GENERATED ALWAYS AS ... STORED`) e gatilhos automáticos (`TRIGGER`) para atualização de carimbos de tempo (*timestamps*).

---

## 📂 Arquivos do Diretório

* **`schema.sql`**: Script DDL completo contendo a criação de tipos, tabelas, chaves primárias, chaves estrangeiras, índices de performance e *triggers* do sistema.
* **`README.md`**: Documentação técnica da arquitetura relacional e dicionário de dados (Entrega 2).

---

## 🚀 Como Executar o Script

### Opção 1: Via Supabase (SQL Editor)
1. Acesse o painel do seu projeto no [Supabase](https://supabase.com/).
2. No menu lateral, clique em **SQL Editor** e selecione **New query**.
3. Copie todo o conteúdo do arquivo `schema.sql`, cole no editor e clique em **Run**.

### Opção 2: Via Terminal (`psql`)
```bash
psql -U seu_usuario -d nome_do_banco -f BD/schema.sql
```

---

## 🏷️ Tipos Enumerados (`ENUM`)

Para garantir a padronização dos estados e categorias no PostgreSQL, o banco declara os seguintes domínios restritos antes da criação das tabelas:

| Tipo (`ENUM`) | Valores Permitidos | Utilizado em |
| :--- | :--- | :--- |
| `perfil_usuario` | `'administrador'`, `'organizador'`, `'fornecedor'`, `'comprador'`, `'revendedor'` | `usuarios.perfil` |
| `status_usuario` | `'pendente'`, `'aprovado'`, `'rejeitado'` | `usuarios.status` |
| `status_evento` | `'rascunho'`, `'publicado'`, `'cancelado'` | `eventos.status` |
| `categoria_item` | `'iluminacao'`, `'alimentacao'`, `'bebida'`, `'seguranca'`, `'infraestrutura'`, `'outros'` | `itens_custo.categoria` |
| `status_proposta` | `'enviada'`, `'selecionada'`, `'cancelada'` | `propostas.status` |
| `status_revenda` | `'pendente'`, `'publicado'`, `'reprovado'`, `'retido'`, `'contestado'`, `'repassado'`, `'estornado'` | `revendas.status` |

---

## 📊 Dicionário de Dados — Módulos Centrais do MVP (Planejamento e Cotação)

As cinco tabelas abaixo compõem o núcleo obrigatório de planejamento de eventos, composição de custos, propostas de fornecedores e cálculo do ticket estimado (RF01 a RF14).

### 1. Tabela: `usuarios`
Armazena todos os atores da plataforma, controlando autenticação, aprovação administrativa e rastreabilidade de quem aprovou o cadastro (RF01 a RF04).

| Campo | Tipo de Dado | PK / FK | Nulo | Padrão (Default) | Descrição e Restrições |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `INTEGER IDENTITY` | **PK** | Não | Auto-incremento | Identificador único do usuário. |
| `nome` | `VARCHAR(120)` | — | Não | — | Nome completo ou responsável. |
| `email` | `VARCHAR(160)` | — | Não | — | E-mail de login (`UNIQUE`). |
| `senha_hash` | `VARCHAR(255)` | — | Não | — | Senha criptografada (hash). |
| `perfil` | `perfil_usuario` | — | Não | — | Perfil de acesso no sistema. |
| `status` | `status_usuario` | — | Não | `'pendente'` | Status do fluxo de aprovação pelo Admin. |
| `telefone` | `VARCHAR(20)` | — | Sim | `NULL` | Telefone de contato. |
| `razao_social` | `VARCHAR(160)` | — | Sim | `NULL` | Nome empresarial (para PJ/Fornecedor). |
| `documento` | `CHAR(14)` | — | Sim | `NULL` | CPF/CNPJ (`UNIQUE`). Obrigatório se `perfil = 'fornecedor'`. |
| `area_atuacao` | `VARCHAR(120)` | — | Sim | `NULL` | Segmento de atuação do fornecedor. |
| `aprovado_por` | `INTEGER` | **FK** | Sim | `NULL` | Referencia `usuarios(id)` (`ON DELETE SET NULL`). |
| `aprovado_em` | `TIMESTAMP` | — | Sim | `NULL` | Data/hora em que o administrador aprovou a conta. |
| `created_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Data de criação do registro. |
| `updated_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Atualizado automaticamente via *trigger*. |

* **Índices:** `idx_usuarios_perfil_status (perfil, status)`
* **Regra de Negócio (`CHECK`):** `chk_usuarios_fornecedor` garante que nenhum fornecedor seja cadastrado sem documento informado.

---

### 2. Tabela: `eventos`
Armazena os eventos criados pelos organizadores, incluindo janela de datas, projeções de público e margem de lucro para cálculo do ticket (RF05, RF08 e RF13).

| Campo | Tipo de Dado | PK / FK | Nulo | Padrão (Default) | Descrição e Restrições |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `INTEGER IDENTITY` | **PK** | Não | Auto-incremento | Identificador único do evento. |
| `organizador_id` | `INTEGER` | **FK** | Não | — | Referencia `usuarios(id)` (`ON DELETE RESTRICT`). |
| `nome` | `VARCHAR(120)` | — | Não | — | Título do evento. |
| `descricao` | `TEXT` | — | Sim | `NULL` | Detalhamento geral do evento. |
| `local_evento` | `VARCHAR(200)` | — | Não | — | Endereço ou espaço de realização. |
| `data_inicio` | `TIMESTAMP` | — | Não | — | Data e hora de início. |
| `data_fim` | `TIMESTAMP` | — | Não | — | Data e hora de término (`>= data_inicio`). |
| `publico_minimo` | `INTEGER` | — | Não | `0` | Cenário conservador de público (`>= 0`). |
| `publico_maximo` | `INTEGER` | — | Não | — | Cenário otimista (`> 0` e `>= publico_minimo`). |
| `publico_esperado` | `INTEGER` | — | Sim | `NULL` | Cenário intermediário (entre mínimo e máximo). |
| `margem_lucro_percentual` | `NUMERIC(5,2)` | — | Não | `0.00` | Margem desejada ($0 \le \text{margem} < 100$). |
| `status` | `status_evento` | — | Não | `'rascunho'` | Controla visibilidade para cotação (`rascunho`, `publicado`, `cancelado`). |
| `created_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Data de criação do evento. |
| `updated_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Atualizado automaticamente via *trigger*. |

* **Índices:** `idx_eventos_organizador`, `idx_eventos_status`, `idx_eventos_data_inicio`.

---

### 3. Tabela: `itens_custo`
Representa as demandas de produtos ou serviços de um evento que serão abertas para cotação pelos fornecedores (RF06).

| Campo | Tipo de Dado | PK / FK | Nulo | Padrão (Default) | Descrição e Restrições |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `INTEGER IDENTITY` | **PK** | Não | Auto-incremento | Identificador único do item de custo. |
| `evento_id` | `INTEGER` | **FK** | Não | — | Referencia `eventos(id)` (`ON DELETE CASCADE`). |
| `nome` | `VARCHAR(120)` | — | Não | — | Nome do item (`UNIQUE` em conjunto com `evento_id`). |
| `categoria` | `categoria_item` | — | Não | — | Categoria padronizada (iluminação, bebida, etc.). |
| `descricao` | `VARCHAR(500)` | — | Sim | `NULL` | Especificações técnicas para orientar propostas. |
| `created_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Data de criação do item. |
| `updated_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Atualizado automaticamente via *trigger*. |

---

### 4. Tabela: `custos_evento`
Registra custos diretos lançados pelo organizador que independem de propostas de fornecedores (RF07).

| Campo | Tipo de Dado | PK / FK | Nulo | Padrão (Default) | Descrição e Restrições |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `INTEGER IDENTITY` | **PK** | Não | Auto-incremento | Identificador único do custo independente. |
| `evento_id` | `INTEGER` | **FK** | Não | — | Referencia `eventos(id)` (`ON DELETE CASCADE`). |
| `descricao` | `VARCHAR(160)` | — | Não | — | Descrição da despesa (ex.: Taxa ECAD, Alvará). |
| `tipo` | `VARCHAR(20)` | — | Não | — | Restrito via `CHECK` a `'fiscal'`, `'operacional'` ou `'variavel'`. |
| `valor` | `NUMERIC(14,2)` | — | Não | — | Valor monetário do custo (`CHECK valor >= 0`). |
| `created_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Data de criação. |
| `updated_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Atualizado automaticamente via *trigger*. |

---

### 5. Tabela: `propostas`
Armazena as cotações enviadas pelos fornecedores aprovados para cada item de custo e controla a proposta vencedora escolhida pelo organizador (RF10 a RF12).

| Campo | Tipo de Dado | PK / FK | Nulo | Padrão (Default) | Descrição e Restrições |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `INTEGER IDENTITY` | **PK** | Não | Auto-incremento | Identificador único da proposta. |
| `item_custo_id` | `INTEGER` | **FK** | Não | — | Referencia `itens_custo(id)` (`ON DELETE CASCADE`). |
| `fornecedor_id` | `INTEGER` | **FK** | Não | — | Referencia `usuarios(id)` (`ON DELETE RESTRICT`). |
| `valor` | `NUMERIC(14,2)` | — | Não | — | Valor ofertado pelo fornecedor (`CHECK valor > 0`). |
| `descricao` | `TEXT` | — | Não | — | Escopo detalhado da proposta comercial. |
| `validade` | `DATE` | — | Não | — | Data limite de validade do orçamento. |
| `observacoes` | `VARCHAR(1000)` | — | Sim | `NULL` | Condições extras ou observações. |
| `status` | `status_proposta` | — | Não | `'enviada'` | Estado (`enviada`, `selecionada`, `cancelada`). |
| `selecao_chave` | `INTEGER STORED` | — | Sim | Coluna Gerada | Recebe `item_custo_id` apenas quando `status = 'selecionada'`. Possui `UNIQUE` para impedir duas propostas selecionadas para o mesmo item. |
| `created_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Data de envio da proposta. |
| `updated_at` | `TIMESTAMP` | — | Não | `CURRENT_TIMESTAMP` | Atualizado automaticamente via *trigger*. |

---

## 🧩 Tabelas Complementares e de Extensão (Ecossistema TrocaTicket)

Além do núcleo de planejamento e precificação, o `schema.sql` implementa estruturas de suporte operacional, contratos, catálogo, bilheteria/revenda e auditoria:

| Tabela | Chave Primária (PK) | Chaves Estrangeiras (FK) | Finalidade no Sistema |
| :--- | :--- | :--- | :--- |
| **`contratos`** | `id` (`VARCHAR(64)`) | `proposta_id` $\rightarrow$ `propostas(id)` | Formaliza o vínculo de uma proposta selecionada (`UNIQUE`). |
| **`servicos`** | `id` (`VARCHAR(64)`) | `fornecedor_id` $\rightarrow$ `usuarios(id)` | Catálogo de serviços e portfólio oferecidos pelos fornecedores. |
| **`catalogo`** | `evento_id` (`INTEGER`) | `evento_id` $\rightarrow$ `eventos(id)` | Metadados de vitrine do evento (cidade, categoria, arte e destaque). |
| **`lotes`** | `id` (`VARCHAR(64)`) | `evento_id` $\rightarrow$ `eventos(id)` | Configuração de lotes, setores, capacidades e valores em centavos. |
| **`reservas`** | `id` (`VARCHAR(64)`) | `usuario_id` $\rightarrow$ `usuarios(id)`<br>`lote_id` $\rightarrow$ `lotes(id)` | Controle temporário de reserva de ingressos com tempo de expiração. |
| **`pedidos`** | `id` (`VARCHAR(64)`) | `reserva_id` $\rightarrow$ `reservas(id)`<br>`comprador_id`, `vendedor_id` $\rightarrow$ `usuarios(id)`<br>`lote_id` $\rightarrow$ `lotes(id)` | Registro consolidado de pedidos, taxas e valores líquidos. |
| **`ingressos`** | `id` (`VARCHAR(64)`) | `lote_id` $\rightarrow$ `lotes(id)`<br>`dono_id` $\rightarrow$ `usuarios(id)`<br>`pedido_id` $\rightarrow$ `pedidos(id)` | Emissão unitária de ingressos com código único e controle de check-in. |
| **`anuncios`** | `id` (`VARCHAR(64)`) | `ingresso_id` $\rightarrow$ `ingressos(id)`<br>`vendedor_id`, `comprador_id` $\rightarrow$ `usuarios(id)`<br>`pedido_id`, `anterior_pedido_id` $\rightarrow$ `pedidos(id)` | Gestão de anúncios de troca/revenda com coluna gerada `chave_ativa` para impedir duplicidade de anúncio ativo para o mesmo ingresso. |
| **`revendas`** | `id` (`INTEGER IDENTITY`) | `vendedor_id`, `comprador_id`, `moderador_id` $\rightarrow$ `usuarios(id)` | Marketplace acadêmico com moderação, hash de código e validação `comprador_id <> vendedor_id`. |
| **`notificacoes`** | `id` (`VARCHAR(64)`) | `usuario_id` $\rightarrow$ `usuarios(id)` | Avisos internos para os usuários com controle de leitura (`lida`). |
| **`auditoria`** | `id` (`VARCHAR(64)`) | — | Log de rastreabilidade de ações administrativas e operacionais. |
| **`recuperacoes`** | `id` (`VARCHAR(64)`) | — | Tokens e controle de tentativas para recuperação de senha por e-mail. |
| **`versoes_sessao`**| `usuario_id` (`INTEGER`) | `usuario_id` $\rightarrow$ `usuarios(id)` | Controle de invalidação e versionamento de sessões ativas (JWT). |
| **`commerce_meta`** | `id` (`VARCHAR(64)`) | — | Tabela chave-valor para configurações globais da plataforma. |

---

## ⚙️ Gatilhos (*Triggers*) e Regras de Integridade

1. **Atualização Automática de Timestamps (`PL/pgSQL`):**
   * `atualizar_timestamp_modificacao()`: Atualiza automaticamente a coluna `updated_at` nas tabelas `usuarios`, `eventos`, `itens_custo`, `custos_evento` e `propostas` a cada `UPDATE`.
   * `atualizar_timestamp_atualizado_em()`: Atualiza a coluna `atualizado_em` na tabela `revendas`.
2. **Garantia de Proposta Vencedora Única no Banco:**
   * A tabela `propostas` utiliza a coluna gerada `selecao_chave` combinada à constraint `uq_proposta_selecionada`. Assim, o próprio SGBD bloqueia qualquer tentativa de selecionar mais de uma proposta para o mesmo item de custo.
3. **Validação da Fórmula do Ticket:**
   * As restrições `chk_eventos_publico` ($\text{público máximo} > 0$) e `chk_eventos_margem` ($0 \le \text{margem} < 100$) impedem divisões por zero ou resultados negativos na aplicação da fórmula:
   $$\text{Ticket} = \frac{\text{Custo Total}}{\text{Público} \times \left(1 - \frac{\text{Margem}}{100}\right)}$$