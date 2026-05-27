(function () {
  const config = window.MARCOS_CONFIG || {};
  const apiUrl = (config.apiUrl || '').replace(/\/$/, '');
  const whatsappNumber = config.whatsappNumber || '5582988920633';
  const brandName = config.brandName || 'Marcos Calçados';

  const els = {
    products: document.querySelector('#products'),
    status: document.querySelector('#status'),
    filters: document.querySelector('#filters'),
    search: document.querySelector('#search'),
    category: document.querySelector('#category'),
    supportLink: document.querySelector('#support-link')
  };

  function endpoint(path) {
    return `${apiUrl}${path}`;
  }

  function money(cents) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format((cents || 0) / 100);
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function categoryName(product) {
    const category = Array.isArray(product.category) ? product.category[0] : product.category;
    return category?.name || 'Sem categoria';
  }

  function whatsappUrl(product) {
    const message = [
      `Olá, ${brandName}!`,
      `Tenho interesse no produto: ${product.name}.`,
      `Preço: ${money(product.price_cents)}.`,
      product.slug ? `Produto: ${window.location.origin}/catalogo.html?produto=${product.slug}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function setStatus(message) {
    els.status.textContent = message || '';
  }

  function productCard(product) {
    const image = product.image_url || 'images/marcos-calcados-logo.svg';
    const description = clean(product.description);

    return `
      <article class="product-card">
        <a class="product-media" href="${whatsappUrl(product)}" target="_blank" rel="noopener">
          <img src="${image}" alt="${product.name}" loading="lazy">
        </a>
        <div class="product-info">
          <span class="category">${categoryName(product)}</span>
          <h2>${product.name}</h2>
          <div class="price">${money(product.price_cents)}</div>
          ${description ? `<p class="description">${description.slice(0, 140)}</p>` : ''}
        </div>
        <footer>
          <a class="whatsapp-button" href="${whatsappUrl(product)}" target="_blank" rel="noopener">
            Comprar pelo WhatsApp
          </a>
        </footer>
      </article>
    `;
  }

  async function fetchJson(path) {
    const response = await fetch(endpoint(path));
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || `Erro HTTP ${response.status}`);
    }

    return body;
  }

  async function loadCategories() {
    const { data } = await fetchJson('/api/categories');

    els.category.innerHTML = '<option value="">Todas as categorias</option>';
    (data || []).forEach((category) => {
      const option = document.createElement('option');
      option.value = category.slug;
      option.textContent = category.name;
      els.category.appendChild(option);
    });
  }

  async function loadProducts() {
    const params = new URLSearchParams();
    const search = els.search.value.trim();
    const category = els.category.value.trim();

    if (search) {
      params.set('q', search);
    }

    if (category) {
      params.set('category', category);
    }

    params.set('limit', '100');
    setStatus('Carregando produtos...');

    const { data } = await fetchJson(`/api/products?${params.toString()}`);

    if (!data?.length) {
      els.products.innerHTML = '';
      setStatus('Nenhum produto encontrado. Cadastre produtos no painel admin.');
      return;
    }

    els.products.innerHTML = data.map(productCard).join('');
    setStatus('');
  }

  els.filters.addEventListener('submit', function (event) {
    event.preventDefault();
    loadProducts().catch((error) => setStatus(error.message));
  });

  els.supportLink.href = `https://wa.me/${whatsappNumber}`;

  Promise.all([loadCategories(), loadProducts()]).catch((error) => {
    els.products.innerHTML = '';
    setStatus(`Não foi possível carregar o catálogo: ${error.message}`);
  });
})();
