# Modelagem de Base de Dados - TrocaTicket (Entrega 1)

Este diretório contém a modelagem lógica e o script de criação do banco de dados (BD) para o MVP da plataforma **TrocaTicket**, focado no planeamento de eventos e gestão de propostas.

## 1. Visão Geral do Modelo Relacional (DER)
O banco de dados segue um modelo relacional normalizado. O fluxo central do sistema rege-se pelos seguintes relacionamentos:
- **`usuarios`**: Tabela central de perfis (`Organizador`, `Fornecedor`, `Participante`, `Admin`). Controla a autenticação e o nível de acesso (RBAC).
- **`eventos`**: Criada por um `Organizador` (Relacionamento 1:N com `usuarios`). Guarda os parâmetros financeiros e físicos do evento.
- **`itens_custo`**: Pertencem a um `Evento` (Relacionamento 1:N com `eventos`). Divide as categorias do orçamento (ex: Segurança, Som).
- **`propostas`**: Pertencem a um `Item de Custo` e são enviadas por um `Fornecedor` (Relacionamento 1:N com `itens_custo` e 1:N com `usuarios`). 

## 2. Dicionário de Dados das Tabelas Principais

### Tabela: `usuarios`
Responsável pela gestão de acesso e autocadastro pendente de aprovação.
* `id_usuario` (INT, PK, AUTO_INCREMENT): Identificador único.
* `nome_completo` (VARCHAR 150): Nome da pessoa ou empresa.
* `email` (VARCHAR 100, UNIQUE): Login de acesso.
* `senha_hash` (VARCHAR 255): Senha encriptada (BCrypt).
* `tipo_perfil` (ENUM): 'Organizador', 'Fornecedor', 'Participante', 'Admin'.
* `status_aprovacao` (ENUM): 'Pendente', 'Aprovado', 'Rejeitado'.

### Tabela: `eventos`
Responsável por armazenar as informações gerais da festa/evento.
* `id_evento` (INT, PK, AUTO_INCREMENT): Identificador único.
* `id_organizador` (INT, FK): FK referenciando `usuarios(id_usuario)`.
* `nome_evento` (VARCHAR 150): Nome da festa (ex: Cervejada).
* `publico_minimo` / `publico_maximo` (INT): Parâmetros para cálculo do ticket.
* `margem_lucro` (DECIMAL 5,2): Porcentagem de lucro desejada pelo organizador.

### Tabela: `itens_custo`
Responsável pelas rubricas de orçamento abertas para cotação.
* `id_item` (INT, PK, AUTO_INCREMENT): Identificador único.
* `id_evento` (INT, FK): FK referenciando `eventos(id_evento)`.
* `categoria` (VARCHAR 100): Setor do serviço (ex: Iluminação).
* `valor_estimado` (DECIMAL 10,2): Previsão inicial de gastos.

### Tabela: `propostas`
Responsável por registar as ofertas feitas pelos fornecedores.
* `id_proposta` (INT, PK, AUTO_INCREMENT): Identificador único.
* `id_item` (INT, FK): Referência ao item cotado.
* `id_fornecedor` (INT, FK): Fornecedor que enviou a proposta.
* `valor_ofertado` (DECIMAL 10,2): Custo real cobrado pelo fornecedor.
* `status_proposta` (ENUM): 'Pendente', 'Aprovada', 'Rejeitada'.

## 3. Script SQL
O ficheiro `schema.sql` presente nesta pasta deve ser executado no MySQL (Workbench ou DBeaver) para criar a estrutura completa das tabelas com as respetivas _Foreign Keys_.
