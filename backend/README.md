# Marcos Calçados Backend

API em TypeScript para conectar a loja Marcos Calçados ao banco Postgres do Supabase.

## Stack

- Node.js + TypeScript
- Fastify para HTTP
- Supabase JS para acesso ao Postgres
- Zod para validar entradas
- Helmet, CORS e rate limit para seguranca basica

## Configuracao

1. Crie as tabelas no Supabase executando `supabase/schema.sql` no SQL Editor.
2. Copie `.env.example` para `.env`.
3. Preencha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_API_KEY`.
4. Instale e rode:

```bash
npm install
npm run dev
```

A API sobe em `http://localhost:3333`.

## Painel admin

Abra `../admin/index.html` no navegador.

No topo do painel, informe:

- API: `http://localhost:3333`
- Chave admin: o mesmo valor de `ADMIN_API_KEY`

O painel permite:

- cadastrar categorias
- cadastrar produtos
- editar dados principais de produtos
- adicionar variacoes por linha
- desativar produtos
- listar pedidos
- alterar status de pedidos

## Catalogo + WhatsApp

O fluxo escolhido para esta versao e catalogo com atendimento pelo WhatsApp.

Arquivos envolvidos:

- `../catalogo.html`: catalogo dinamico que busca produtos em `/api/products`
- `../catalogo.js`: monta os cards e links de WhatsApp
- `../js/marcos-config.js`: define URL da API e numero do WhatsApp
- `../js/marcos-whatsapp.js`: transforma botoes "Comprar" do site salvo em links de WhatsApp

Antes do deploy, ajuste `../js/marcos-config.js`:

```js
window.MARCOS_CONFIG = {
  apiUrl: 'https://URL-DO-SEU-BACKEND',
  whatsappNumber: '5582988920633',
  brandName: 'Marcos Calçados'
};
```

Se o site e o backend ficarem no mesmo dominio, `apiUrl` pode ser vazio:

```js
apiUrl: ''
```

## Deploy recomendado

Como a hospedagem ainda nao foi definida, o caminho mais simples e:

- Site estatico: Netlify ou Vercel
- Backend: Render ou Railway
- Banco: Supabase

No backend hospedado, configure as variaveis:

```txt
NODE_ENV=production
HOST=0.0.0.0
PORT=3333
SUPABASE_URL=https://tqzfeoumzdubicfkbeyb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
ADMIN_API_KEY=sua-chave-admin
CORS_ORIGIN=https://seu-dominio
```

## Endpoints

```txt
GET  /health
GET  /api/categories
GET  /api/products
GET  /api/products?category=camisas&limit=12&page=1
GET  /api/products/:slug
POST /api/newsletter
POST /api/contact
POST /api/orders
```

Rotas protegidas do admin:

```txt
GET    /api/admin/overview
GET    /api/admin/categories
POST   /api/admin/categories
PATCH  /api/admin/categories/:id
GET    /api/admin/products
POST   /api/admin/products
PATCH  /api/admin/products/:id
DELETE /api/admin/products/:id
POST   /api/admin/products/:id/variants
PATCH  /api/admin/variants/:id
DELETE /api/admin/variants/:id
GET    /api/admin/orders
PATCH  /api/admin/orders/:id/status
```

Todas essas rotas exigem o header:

```txt
x-admin-api-key: sua-chave-admin
```

## Exemplos

Newsletter:

```bash
curl -X POST http://localhost:3333/api/newsletter \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"cliente@email.com\",\"name\":\"Cliente\"}"
```

Criar pedido:

```bash
curl -X POST http://localhost:3333/api/orders \
  -H "Content-Type: application/json" \
  -d "{\"customer\":{\"name\":\"Cliente\",\"email\":\"cliente@email.com\"},\"items\":[{\"productId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1}]}"
```

## Observacoes importantes

- A `SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para o frontend.
- A `ADMIN_API_KEY` protege o painel, mas nao substitui login completo em producao.
- O backend calcula o valor do pedido buscando os precos no banco.
- Para checkout real com pagamento, integre depois um provedor como Mercado Pago, Stripe ou Nuvem Pago.
- O snapshot atual do site ainda usa muitos dados e imagens vindos da Nuvemshop; esta API prepara a base para migrar produtos, newsletter, contatos e pedidos para o Supabase.
