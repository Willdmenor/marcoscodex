const state = {
  apiUrl: localStorage.getItem('marcosAdminApiUrl') || 'http://localhost:3333',
  adminKey: localStorage.getItem('marcosAdminKey') || '',
  categories: [],
  products: [],
  orders: [],
  productSearch: ''
};

const $ = (selector) => document.querySelector(selector);

const els = {
  connectionForm: $('#connection-form'),
  apiUrl: $('#api-url'),
  adminKey: $('#admin-key'),
  status: $('#connection-status'),
  stats: $('#stats'),
  tabs: document.querySelectorAll('.tab'),
  panels: document.querySelectorAll('.panel'),
  productForm: $('#product-form'),
  productFormTitle: $('#product-form-title'),
  productId: $('#product-id'),
  productName: $('#product-name'),
  productSlug: $('#product-slug'),
  productCategory: $('#product-category'),
  productDescription: $('#product-description'),
  productPrice: $('#product-price'),
  productComparePrice: $('#product-compare-price'),
  productSku: $('#product-sku'),
  productStock: $('#product-stock'),
  productImage: $('#product-image'),
  productActive: $('#product-active'),
  productVariants: $('#product-variants'),
  productSearchForm: $('#product-search-form'),
  productSearch: $('#product-search'),
  productsBody: $('#products-body'),
  newProduct: $('#new-product'),
  clearProduct: $('#clear-product'),
  categoryForm: $('#category-form'),
  categoryName: $('#category-name'),
  categorySlug: $('#category-slug'),
  categoriesBody: $('#categories-body'),
  ordersBody: $('#orders-body'),
  refreshOrders: $('#refresh-orders'),
  toast: $('#toast')
};

els.apiUrl.value = state.apiUrl;
els.adminKey.value = state.adminKey;

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 3200);
}

function setStatus(message, ok = false) {
  els.status.textContent = message;
  els.status.style.color = ok ? 'var(--ok)' : 'var(--gold-soft)';
}

function apiPath(path) {
  return `${state.apiUrl.replace(/\/$/, '')}${path}`;
}

async function api(path, options = {}) {
  const response = await fetch(apiPath(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-api-key': state.adminKey,
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `Erro HTTP ${response.status}`);
  }

  return body;
}

function toCents(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number(normalized);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error('Preço inválido');
  }

  return Math.round(number * 100);
}

function fromCents(cents) {
  if (cents === null || cents === undefined) {
    return '';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100);
}

function parseOptionalCents(value) {
  return String(value || '').trim() ? toCents(value) : null;
}

function parseOptionalInt(value) {
  return String(value || '').trim() ? Number.parseInt(value, 10) : null;
}

function parseVariants(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, sku, price, stock] = line.split('|').map((part) => part?.trim() || '');

      if (!name) {
        throw new Error('Toda variação precisa ter nome');
      }

      return {
        name,
        sku: sku || null,
        price_cents: price ? toCents(price) : null,
        stock: stock ? Number.parseInt(stock, 10) : null,
        is_active: true
      };
    });
}

function getCategoryName(product) {
  const category = Array.isArray(product.category) ? product.category[0] : product.category;
  return category?.name || 'Sem categoria';
}

function renderStats(data) {
  els.stats.innerHTML = `
    <span>Produtos: ${data.products}</span>
    <span>Categorias: ${data.categories}</span>
    <span>Pedidos: ${data.orders}</span>
    <span>Newsletter: ${data.subscribers}</span>
  `;
}

function renderCategories() {
  els.productCategory.innerHTML = '<option value="">Sem categoria</option>';

  state.categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    els.productCategory.appendChild(option);
  });

  if (!state.categories.length) {
    els.categoriesBody.innerHTML = '<tr><td colspan="2">Nenhuma categoria cadastrada.</td></tr>';
    return;
  }

  els.categoriesBody.innerHTML = state.categories
    .map((category) => `<tr><td>${category.name}</td><td>${category.slug}</td></tr>`)
    .join('');
}

function renderProducts() {
  if (!state.products.length) {
    els.productsBody.innerHTML = '<tr><td colspan="5">Nenhum produto encontrado.</td></tr>';
    return;
  }

  els.productsBody.innerHTML = state.products
    .map((product) => {
      const image = product.image_url || '../images/marcos-calcados-logo.svg';
      const variants = product.variants?.length || 0;
      const stock = product.stock ?? '-';

      return `
        <tr>
          <td>
            <div class="product-cell">
              <img src="${image}" alt="">
              <div>
                <strong>${product.name}</strong>
                <span class="muted">${getCategoryName(product)} | ${variants} variação(ões)</span>
                <span class="muted">${product.slug}</span>
              </div>
            </div>
          </td>
          <td>${fromCents(product.price_cents)}</td>
          <td>${stock}</td>
          <td><span class="pill ${product.is_active ? '' : 'off'}">${product.is_active ? 'Ativo' : 'Inativo'}</span></td>
          <td>
            <div class="row-actions">
              <button type="button" data-edit-product="${product.id}">Editar</button>
              <button class="ghost" type="button" data-disable-product="${product.id}">Desativar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderOrders() {
  if (!state.orders.length) {
    els.ordersBody.innerHTML = '<tr><td colspan="4">Nenhum pedido encontrado.</td></tr>';
    return;
  }

  els.ordersBody.innerHTML = state.orders
    .map((order) => {
      const itemSummary = (order.items || [])
        .map((item) => `${item.quantity}x ${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''}`)
        .join('<br>');

      return `
        <tr>
          <td>
            <strong>${order.customer_name}</strong>
            <span class="muted">${order.customer_email}</span>
          </td>
          <td>${fromCents(order.total_cents)}</td>
          <td>
            <select data-order-status="${order.id}">
              ${['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
                .map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`)
                .join('')}
            </select>
          </td>
          <td>${itemSummary || '-'}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadOverview() {
  const { data } = await api('/api/admin/overview');
  renderStats(data);
}

async function loadCategories() {
  const { data } = await api('/api/admin/categories');
  state.categories = data || [];
  renderCategories();
}

async function loadProducts() {
  const query = state.productSearch ? `?q=${encodeURIComponent(state.productSearch)}` : '';
  const { data } = await api(`/api/admin/products${query}`);
  state.products = data || [];
  renderProducts();
}

async function loadOrders() {
  const { data } = await api('/api/admin/orders');
  state.orders = data || [];
  renderOrders();
}

async function refreshAll() {
  await loadOverview();
  await loadCategories();
  await loadProducts();
  await loadOrders();
}

function productPayload() {
  return {
    category_id: els.productCategory.value || null,
    name: els.productName.value.trim(),
    slug: els.productSlug.value.trim() || undefined,
    description: els.productDescription.value.trim() || null,
    price_cents: toCents(els.productPrice.value),
    compare_at_price_cents: parseOptionalCents(els.productComparePrice.value),
    sku: els.productSku.value.trim() || null,
    image_url: els.productImage.value.trim() || null,
    stock: parseOptionalInt(els.productStock.value),
    is_active: els.productActive.checked
  };
}

function resetProductForm() {
  els.productForm.reset();
  els.productId.value = '';
  els.productActive.checked = true;
  els.productFormTitle.textContent = 'Adicionar produto';
}

function fillProductForm(product) {
  els.productId.value = product.id;
  els.productName.value = product.name || '';
  els.productSlug.value = product.slug || '';
  els.productCategory.value = product.category_id || '';
  els.productDescription.value = product.description || '';
  els.productPrice.value = product.price_cents ? String(product.price_cents / 100).replace('.', ',') : '';
  els.productComparePrice.value = product.compare_at_price_cents
    ? String(product.compare_at_price_cents / 100).replace('.', ',')
    : '';
  els.productSku.value = product.sku || '';
  els.productStock.value = product.stock ?? '';
  els.productImage.value = product.image_url || '';
  els.productActive.checked = Boolean(product.is_active);
  els.productVariants.value = '';
  els.productVariants.placeholder = 'Use este campo apenas para adicionar novas variações ao produto editado.';
  els.productFormTitle.textContent = 'Editar produto';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

els.connectionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.apiUrl = els.apiUrl.value.trim();
  state.adminKey = els.adminKey.value.trim();
  localStorage.setItem('marcosAdminApiUrl', state.apiUrl);
  localStorage.setItem('marcosAdminKey', state.adminKey);

  try {
    await refreshAll();
    setStatus('Conectado', true);
    toast('Painel conectado com sucesso.');
  } catch (error) {
    setStatus('Falha na conexão');
    toast(error.message);
  }
});

els.tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    els.tabs.forEach((item) => item.classList.remove('is-active'));
    els.panels.forEach((panel) => panel.classList.remove('is-active'));
    tab.classList.add('is-active');
    $(`#tab-${tab.dataset.tab}`).classList.add('is-active');
  });
});

els.categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    await api('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: els.categoryName.value.trim(),
        slug: els.categorySlug.value.trim() || undefined
      })
    });
    els.categoryForm.reset();
    await loadCategories();
    await loadOverview();
    toast('Categoria salva.');
  } catch (error) {
    toast(error.message);
  }
});

els.productForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const id = els.productId.value;
    const variants = parseVariants(els.productVariants.value);

    if (id) {
      await api(`/api/admin/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(productPayload())
      });

      await Promise.all(
        variants.map((variant) =>
          api(`/api/admin/products/${id}/variants`, {
            method: 'POST',
            body: JSON.stringify(variant)
          })
        )
      );
      toast('Produto atualizado.');
    } else {
      await api('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          ...productPayload(),
          variants
        })
      });
      toast('Produto criado.');
    }

    resetProductForm();
    await loadProducts();
    await loadOverview();
  } catch (error) {
    toast(error.message);
  }
});

els.productsBody.addEventListener('click', async (event) => {
  const editId = event.target.dataset.editProduct;
  const disableId = event.target.dataset.disableProduct;

  if (editId) {
    const product = state.products.find((item) => item.id === editId);
    if (product) {
      fillProductForm(product);
    }
  }

  if (disableId) {
    const confirmed = window.confirm('Desativar este produto na loja?');

    if (!confirmed) {
      return;
    }

    try {
      await api(`/api/admin/products/${disableId}`, { method: 'DELETE' });
      await loadProducts();
      await loadOverview();
      toast('Produto desativado.');
    } catch (error) {
      toast(error.message);
    }
  }
});

els.ordersBody.addEventListener('change', async (event) => {
  const orderId = event.target.dataset.orderStatus;

  if (!orderId) {
    return;
  }

  try {
    await api(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: event.target.value })
    });
    toast('Status do pedido atualizado.');
  } catch (error) {
    toast(error.message);
  }
});

els.productSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.productSearch = els.productSearch.value.trim();

  try {
    await loadProducts();
  } catch (error) {
    toast(error.message);
  }
});

els.newProduct.addEventListener('click', resetProductForm);
els.clearProduct.addEventListener('click', resetProductForm);
els.refreshOrders.addEventListener('click', () => loadOrders().catch((error) => toast(error.message)));

if (state.adminKey) {
  refreshAll()
    .then(() => setStatus('Conectado', true))
    .catch(() => setStatus('Chave salva, aguardando reconexão'));
}
