# Linha & Laço

Sistema web de gestão para ateliês de confecção e serviços personalizados. É um **ERP leve verticalizado**, com recursos de CRM, operação comercial, formação de preço, produção e financeiro básico em uma única aplicação responsiva e instalável.

Não há aplicações separadas de site e backoffice: a pessoa proprietária acessa todo o sistema por uma única interface protegida.

## Visão geral

A Linha & Laço centraliza o fluxo diário do ateliê:

```text
Cliente → Orçamento → Aprovação → Produção → Entrega → Pagamento
                  ↘ PDF comercial e fotos de referência
```

A aplicação foi desenhada para uma única usuária, mas todos os registros possuem proprietário e políticas de segurança. Isso preserva o isolamento dos dados e permite crescimento futuro sem reformulação estrutural do banco.

## Módulos

### Acesso e configurações

- Login por **nome de usuário e senha**, internamente protegido pelo Supabase Auth.
- Rotas internas inacessíveis sem sessão autenticada.
- Alteração de senha e configuração comercial do ateliê.
- Nome do negócio, telefone e moeda brasileira nas configurações.

### Dashboard

- Visão de vendas registradas, pedidos ativos, orçamentos e clientes.
- Acesso rápido para novos clientes e novos orçamentos.
- Lista dos pedidos recentes para acompanhar o andamento da operação.

### Clientes

- Cadastro, edição e exclusão confirmada.
- Nome, telefone, e-mail e observações.
- Pedidos antigos preservam o nome do cliente mesmo se o cadastro for removido.

### Produtos e serviços

- Cadastro de serviços e confecções.
- Descrição, observações internas, prazo estimado e status ativo.
- Galeria privada de imagens para produtos; a primeira foto é usada como capa.
- Dois modos de preço:
  - **Por custo e margem:** materiais + mão de obra + custos indiretos, com margem percentual própria.
  - **Preço fixo:** valor definido manualmente, mantendo os custos apenas como referência.
- Categorias e tabelas de preço antigas são preservadas no banco, porém desativadas e fora da operação atual.

### Materiais e receitas

- Catálogo reutilizável de materiais, com descrição, valor por unidade e status ativo.
- Fotos privadas por material, com capa automática.
- Unidades conversíveis por família:
  - Comprimento: `mm`, `cm`, `m`
  - Peso: `mg`, `g`, `kg`
  - Volume: `ml`, `L`
  - Contagem: `un`
- Cálculo proporcional de consumo. Exemplo: material a R$ 10,00 por metro e uso de 30 cm resulta em R$ 3,00 de custo.
- Receita de produto com busca digitável de materiais e criação rápida sem sair do formulário.
- Alterações no valor de material recalculam custo e preço de produtos no modo por custo; pedidos existentes preservam seus valores comerciais.

### Orçamentos e pedidos

- Pedidos com múltiplos itens, quantidade, preço unitário, desconto e total calculado.
- Dados comerciais: data de emissão, validade, previsão de entrega, condições de pagamento e observações.
- Status: `Orçamento` → `Aprovado` → `Em produção` → `Entregue`.
- Botões de avanço de status destacados e descritivos.
- Valores de itens, cliente e produtos são mantidos como snapshots nos pedidos para preservar o histórico.
- Exclusão confirmada remove itens, fotos e pagamentos relacionados.

### PDF comercial e fotos do orçamento

- Prévia comercial com dados do ateliê, cliente, itens, totais, datas, condições e observações.
- Geração de PDF pronto para baixar, imprimir ou compartilhar.
- Fotos JPEG, PNG e WebP, com até 8 imagens por orçamento.
- Em dispositivos compatíveis, há ação de câmera; em desktop, seleção de arquivos do computador.
- Imagens são comprimidas/redimensionadas antes do upload e armazenadas em bucket privado.
- A geração do PDF é registrada na auditoria. O envio real por e-mail ainda não está incluído.

### Financeiro básico

- Registro, edição e exclusão confirmada de pagamentos.
- Formas de pagamento reutilizáveis: Pix, dinheiro, cartão de crédito, cartão de débito e transferência.
- As formas podem ser criadas, editadas, desativadas ou excluídas. Pagamentos antigos preservam o nome usado no momento do lançamento.
- Ao mover um pedido para **Entregue**, o sistema sugere registrar o pagamento com o saldo pendente; o lançamento é opcional.

### Anotações e auditoria

- Anotações com título e conteúdo livre.
- Confirmação antes de qualquer exclusão de entidade de negócio.
- Página de logs somente leitura, com registros de criação, edição, exclusão e geração de PDF.
- Gatilhos PostgreSQL registram eventos mesmo se a alteração ocorrer fora da interface.

## Tecnologia

| Camada | Tecnologia |
| --- | --- |
| Aplicação full-stack | Next.js 16 + React 19 + TypeScript |
| Interface | Tailwind CSS, CSS próprio e Lucide Icons |
| Autenticação | Supabase Auth |
| Banco | PostgreSQL gerenciado pelo Supabase |
| Arquivos | Supabase Storage privado |
| PDF | jsPDF |
| Testes | Vitest |
| Hospedagem | Vercel |
| Versionamento | GitHub |

## Segurança e dados

- Todas as tabelas de negócio possuem `owner_id`.
- Row Level Security (RLS) limita cada sessão aos próprios dados.
- Buckets de imagens são privados; a interface gera URLs assinadas de curta duração para exibição.
- A chave pública do Supabase pode ser usada no navegador em conjunto com RLS.
- Nunca adicione uma chave `service_role`, senha de banco ou segredo de provedor ao repositório, navegador ou variáveis `NEXT_PUBLIC_*`.

## Estrutura do projeto

```text
src/
  app/                 Rotas, layout, login, manifesto e estilos globais
  components/          Área autenticada, formulários e componentes reutilizáveis
  lib/                 Regras de domínio, moeda, unidades, PDF e Supabase
supabase/
  migrations/          Evolução versionada do PostgreSQL, RLS, Storage e gatilhos
public/
  sw.js                Service worker do PWA
```

## Banco de dados e migrações

As migrações devem ser aplicadas em ordem crescente no **Supabase → SQL Editor**. Em um banco novo, execute todos os arquivos em `supabase/migrations/`, incluindo:

- `202609200001_unified_nextjs.sql`
- `202609200004_commercial_materials_audit.sql`
- `202609210005_catalog_media_payments_pricing.sql`

A última migração adiciona a galeria de catálogo, o bucket `linha-e-laco-catalog-media`, formas de pagamento, preço fixo, observações de produto, auditoria e ajustes de recálculo.

> Aplique e valide a migração antes de publicar uma versão da interface que dependa dos novos campos ou tabelas.

## Configuração local

### Pré-requisitos

- Node.js 20 ou superior.
- Projeto Supabase configurado e com as migrações aplicadas.

### Variáveis de ambiente

Crie o arquivo `.env.local` com as variáveis públicas do projeto Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
```

### Comandos

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

Comandos de qualidade:

```bash
npm run lint
npm run test
npm run build
```

## PWA e uso offline

A aplicação pode ser instalada no desktop e smartphone pelo navegador após o primeiro acesso online. O service worker mantém a interface disponível sem conexão e o navegador preserva o último estado carregado.

Operações que alteram o Supabase, imagens, auditoria e geração de PDF dependem de conexão. Ainda não há sincronização automática de cadastros criados offline quando a rede retorna.

## Publicação

1. Envie o código para o repositório GitHub `RKXP-Software/linha-e-laco-nextjs`.
2. Importe o repositório na Vercel.
3. Configure na Vercel as mesmas variáveis públicas do Supabase.
4. Aplique as migrações no projeto Supabase de produção.
5. Publique a branch `main` e conecte o domínio próprio, se houver.

A produção atual está em [linha-e-laco-nextjs.vercel.app](https://linha-e-laco-nextjs.vercel.app).

## Limites atuais e próximas evoluções

O escopo atual não inclui controle de estoque, fornecedores, contas a pagar, fluxo de caixa completo, emissão fiscal, integração contábil ou envio transacional de e-mail/WhatsApp.

As próximas evoluções naturais são envio de orçamento por e-mail, estoque de materiais, agenda de produção, relatório financeiro e integrações de comunicação.
