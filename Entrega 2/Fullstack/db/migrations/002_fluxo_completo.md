# Migração 002 · Fluxo completo (Entrega 2)

A versão 2 do schema **não é compatível** com a versão 1 (a tabela `eventos` ganha
`organizador_id` obrigatório e novas tabelas são criadas).

- **Banco novo (recomendado):** `mysql -u root -p < db/schema.sql`
- **Banco existente com dados de teste:** faça backup (`mysqldump trocaticket > backup.sql`),
  depois `DROP DATABASE trocaticket;` e execute `db/schema.sql` e `db/seed.sql` novamente.
- Eventos criados na versão 1 não têm organizador. Recrie-os pelo sistema ou pelo seed.
