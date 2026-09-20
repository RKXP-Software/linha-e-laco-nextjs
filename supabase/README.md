# Banco Supabase do Linha & Laço

A estrutura do banco fica em `migrations/202609170001_initial_schema.sql` e deve ser aplicada uma única vez ao projeto Supabase `lgzkdodzpkvywoekaolv`.

## Aplicar pelo painel

1. Abra o SQL Editor do projeto Supabase.
2. Crie uma nova consulta e cole o conteúdo da migração inicial.
3. Execute a consulta e confirme que as tabelas `clients`, `catalog_items`, `orders` e `notes` aparecem no Table Editor.

## API no Railway

Em **Variables**, defina `ConnectionStrings__Supabase` com a string copiada de **Connect > Session pooler**. A senha pertence somente ao Railway, nunca a este repositório. Use o pooler em modo de sessão para compatibilidade de rede IPv4.

Depois da migração e da variável configurada, faça um novo deploy da API. O endpoint `/health` responderá com `database: connected` quando o banco estiver acessível.