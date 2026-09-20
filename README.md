# Linha & Laço — Next.js

Aplicação única para gestão de ateliê, criada em Next.js, TypeScript, Supabase e preparada para deploy na Vercel e instalação como PWA.

## Recursos

- Login, recuperação e alteração de senha com Supabase Auth.
- Dashboard, clientes, pedidos, agenda, financeiro simplificado, relatórios e anotações formatadas.
- Produtos e serviços com materiais, custos de mão de obra e indiretos, custo de produção e preço sugerido.
- Tabelas de preços com margem percentual reutilizável.
- PWA instalável em desktop e smartphone, com cache do aplicativo, página offline e cópia local dos dados já carregados.

## Estrutura

- `src/`: aplicação Next.js.
- `supabase/migrations/`: banco PostgreSQL, RLS e modelo de custos/formação de preço.
- `public/sw.js`: service worker do PWA.

## Desenvolvimento

1. Copie `.env.example` para `.env.local`.
2. Informe `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Aplique todas as migrações em um projeto Supabase exclusivo da Linha & Laço.
4. Execute `npm install` e `npm run dev`.

## PWA e uso offline

Após o primeiro acesso com internet, instale pelo comando “Instalar aplicativo” do navegador. O service worker mantém a interface disponível sem rede e o navegador preserva localmente o último estado carregado e os novos cadastros feitos offline.

Alterações feitas sem conexão ainda não são sincronizadas automaticamente ao Supabase quando a rede retorna; elas permanecem no dispositivo até a próxima etapa de sincronização offline.

## Publicação

Importe este diretório na Vercel, conecte o repositório `RKXP-Software/linha-e-laco-nextjs` e configure as duas variáveis públicas do Supabase. Use um projeto Supabase separado para desenvolvimento e produção.

Nunca use nem publique uma chave `service_role` no navegador.
