(function () {
  const config = window.MARCOS_CONFIG || {};
  const whatsappNumber = config.whatsappNumber || '5582988920633';
  const brandName = config.brandName || 'Marcos Calçados';

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function productDataFrom(element) {
    const scope =
      element.closest('.js-item-product') ||
      element.closest('.js-product-container') ||
      element.closest('.js-product-form') ||
      document;
    const link = scope.querySelector('.item-link[href], .js-product-item-image-link-private[href], a[href*="/produtos/"]');
    const name =
      clean(scope.querySelector('.js-item-name, [data-store^="product-item-name"]')?.textContent) ||
      clean(link?.getAttribute('title')) ||
      clean(link?.getAttribute('aria-label')) ||
      clean(document.title);
    const price = clean(scope.querySelector('.js-price-display, .item-price')?.textContent);
    const url = link?.href || window.location.href;

    return { name, price, url };
  }

  function whatsappUrl(product) {
    const message = [
      `Olá, ${brandName}!`,
      `Tenho interesse no produto: ${product.name || 'produto do catálogo'}.`,
      product.price ? `Preço visto no site: ${product.price}.` : '',
      product.url ? `Link: ${product.url}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function openProductWhatsapp(target) {
    window.open(whatsappUrl(productDataFrom(target)), '_blank', 'noopener,noreferrer');
  }

  document.addEventListener('click', function (event) {
    const target = event.target;
    const buyButton = target.closest(
      '.js-addtocart, .js-quickshop-modal-open, input[value="Comprar"], button[type="submit"]'
    );

    if (!buyButton) {
      return;
    }

    const productForm = buyButton.closest('.js-product-form');
    const isProductBuy = productForm || buyButton.closest('.js-item-product');

    if (!isProductBuy) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openProductWhatsapp(buyButton);
  });

  document.addEventListener('submit', function (event) {
    const form = event.target.closest('.js-product-form[action="/comprar/"]');

    if (!form) {
      return;
    }

    event.preventDefault();
    openProductWhatsapp(form);
  });

  function createCatalogButton() {
    if (document.querySelector('.mc-catalog-shortcut')) {
      return;
    }

    const link = document.createElement('a');
    link.className = 'mc-catalog-shortcut';
    link.href = 'catalogo.html';
    link.textContent = 'Catálogo WhatsApp';
    link.setAttribute('aria-label', 'Abrir catálogo com compra pelo WhatsApp');
    document.body.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      .mc-catalog-shortcut {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483000;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 16px;
        border: 1px solid #f5d76e;
        border-radius: 999px;
        color: #050505;
        background: #d4af37;
        box-shadow: 0 10px 35px rgba(0, 0, 0, .35);
        font: 700 13px/1 Inter, Arial, sans-serif;
        text-decoration: none;
      }

      .mc-catalog-shortcut:hover,
      .mc-catalog-shortcut:focus {
        color: #050505;
        opacity: .92;
      }

      @media (max-width: 640px) {
        .mc-catalog-shortcut {
          right: 10px;
          bottom: 10px;
          max-width: calc(100vw - 20px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createCatalogButton);
  } else {
    createCatalogButton();
  }
})();
