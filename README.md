# Linha & Laço — Next.js

Aplicação única para gestão de ateliê, criada em Next.js, TypeScript, Supabase e preparada para deploy na Vercel e instalação como PWA.

## Recursos

- Login por usuário e alteração de senha com Supabase Auth.
- Dashboard, clientes, pedidos, agenda, financeiro simplificado, relatórios e anotações formatadas.
- Catálogo global de materiais com unidades conversíveis, receitas de produtos, custos de produção e atualização automática de preços.
- Orçamentos com múltiplos itens, condições comerciais, fotos, prévia e PDF profissional para download.
- CRUD com confirmação de exclusão e logs de auditoria para operações comerciais.

## Estrutura

- `src/`: aplicação Next.js.
- `supabase/migrations/`: banco PostgreSQL, RLS e modelo de custos/formação de preço.
- `public/sw.js`: service worker do PWA.

## Desenvolvimento

1. Copie `.env.example` para `.env.local`.
2. Informe `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Aplique as migrações em ordem crescente de versão, incluindo `202609200004_commercial_materials_audit.sql`, em um projeto Supabase exclusivo da Linha & Laço.
4. Execute `npm install` e `npm run dev`.

## PWA e uso offline

Após o primeiro acesso com internet, instale pelo comando “Instalar aplicativo” do navegador. O service worker mantém a interface disponível sem rede e o navegador preserva localmente o último estado carregado e os novos cadastros feitos offline.

Alterações feitas sem conexão ainda não são sincronizadas automaticamente ao Supabase quando a rede retorna; elas permanecem no dispositivo até a próxima etapa de sincronização offline. Fotos, geração de PDF e operações de auditoria exigem conexão.

## Publicação

Importe este diretório na Vercel, conecte o repositório `RKXP-Software/linha-e-laco-nextjs` e configure as duas variáveis públicas do Supabase. Use um projeto Supabase separado para desenvolvimento e produção.

Nunca use nem publique uma chave `service_role` no navegador.

## Orçamentos

Nesta versão, o orçamento é gerado como PDF para download. O envio real por e-mail será integrado em etapa posterior, por um provedor transacional configurado no servidor.
