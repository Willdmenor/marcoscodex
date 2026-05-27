import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../lib/admin-auth.js';
import { supabase } from '../lib/supabase.js';
import { slugify } from '../utils/slug.js';

const paginationSchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const uuidParamsSchema = z.object({
  id: z.string().uuid()
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(160).optional()
});

const variantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(80).nullable().optional(),
  price_cents: z.coerce.number().int().min(0).nullable().optional(),
  stock: z.coerce.number().int().min(0).nullable().optional(),
  is_active: z.boolean().default(true)
});

const createProductSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  price_cents: z.coerce.number().int().min(0),
  compare_at_price_cents: z.coerce.number().int().min(0).nullable().optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  image_url: z.string().trim().url().nullable().optional(),
  stock: z.coerce.number().int().min(0).nullable().optional(),
  is_active: z.boolean().default(true),
  variants: z.array(variantSchema).max(50).optional()
});

const updateProductSchema = createProductSchema.partial().extend({
  is_active: z.boolean().optional()
});

const updateOrderStatusSchema = z.object({
  status: z
    .enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'])
    .default('pending')
});

function cleanNullable(value?: string | null) {
  return value && value.length > 0 ? value : null;
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAdmin);

  app.get('/api/admin/overview', async (_, reply) => {
    const [products, categories, orders, subscribers] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('categories').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true })
    ]);

    const error = products.error ?? categories.error ?? orders.error ?? subscribers.error;

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'overview_fetch_failed' });
    }

    return {
      data: {
        products: products.count ?? 0,
        categories: categories.count ?? 0,
        orders: orders.count ?? 0,
        subscribers: subscribers.count ?? 0
      }
    };
  });

  app.get('/api/admin/categories', async (_, reply) => {
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,slug,created_at')
      .order('name', { ascending: true });

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'categories_fetch_failed' });
    }

    return { data };
  });

  app.post('/api/admin/categories', async (request, reply) => {
    const payload = categorySchema.parse(request.body);

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: payload.name,
        slug: payload.slug ? slugify(payload.slug) : slugify(payload.name)
      })
      .select('id,name,slug,created_at')
      .single();

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'category_create_failed' });
    }

    return reply.code(201).send({ data });
  });

  app.patch('/api/admin/categories/:id', async (request, reply) => {
    const { id } = uuidParamsSchema.parse(request.params);
    const payload = categorySchema.partial().parse(request.body);

    const { data, error } = await supabase
      .from('categories')
      .update({
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.slug ? { slug: slugify(payload.slug) } : {})
      })
      .eq('id', id)
      .select('id,name,slug,created_at')
      .single();

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'category_update_failed' });
    }

    return { data };
  });

  app.get('/api/admin/products', async (request, reply) => {
    const params = paginationSchema.parse(request.query);
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;

    let query = supabase
      .from('products')
      .select(
        `
          id,
          category_id,
          name,
          slug,
          description,
          price_cents,
          compare_at_price_cents,
          sku,
          image_url,
          stock,
          is_active,
          created_at,
          updated_at,
          category:categories(id,name,slug),
          variants:product_variants(id,name,sku,price_cents,stock,is_active)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (params.q) {
      const search = params.q.replace(/[%,()]/g, ' ').trim();

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'products_fetch_failed' });
    }

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count ?? 0
      }
    };
  });

  app.post('/api/admin/products', async (request, reply) => {
    const payload = createProductSchema.parse(request.body);

    const { variants, ...productPayload } = payload;
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        ...productPayload,
        slug: productPayload.slug ? slugify(productPayload.slug) : slugify(productPayload.name),
        description: cleanNullable(productPayload.description),
        sku: cleanNullable(productPayload.sku),
        image_url: cleanNullable(productPayload.image_url)
      })
      .select('id,name,slug')
      .single();

    if (error || !product) {
      app.log.error(error);
      return reply.code(500).send({ error: 'product_create_failed' });
    }

    if (variants?.length) {
      const { error: variantsError } = await supabase.from('product_variants').insert(
        variants.map((variant) => ({
          product_id: product.id,
          name: variant.name,
          sku: cleanNullable(variant.sku),
          price_cents: variant.price_cents ?? null,
          stock: variant.stock ?? null,
          is_active: variant.is_active
        }))
      );

      if (variantsError) {
        app.log.error(variantsError);
        return reply.code(500).send({ error: 'product_variants_create_failed', data: product });
      }
    }

    return reply.code(201).send({ data: product });
  });

  app.patch('/api/admin/products/:id', async (request, reply) => {
    const { id } = uuidParamsSchema.parse(request.params);
    const payload = updateProductSchema.parse(request.body);

    const { variants: _variants, ...productPayload } = payload;
    const updatePayload = {
      ...productPayload,
      ...(productPayload.slug ? { slug: slugify(productPayload.slug) } : {}),
      ...(productPayload.description !== undefined
        ? { description: cleanNullable(productPayload.description) }
        : {}),
      ...(productPayload.sku !== undefined ? { sku: cleanNullable(productPayload.sku) } : {}),
      ...(productPayload.image_url !== undefined
        ? { image_url: cleanNullable(productPayload.image_url) }
        : {})
    };

    const { data, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('id,name,slug,is_active')
      .single();

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'product_update_failed' });
    }

    return { data };
  });

  app.delete('/api/admin/products/:id', async (request, reply) => {
    const { id } = uuidParamsSchema.parse(request.params);

    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'product_deactivate_failed' });
    }

    return reply.code(204).send();
  });

  app.post('/api/admin/products/:id/variants', async (request, reply) => {
    const { id } = uuidParamsSchema.parse(request.params);
    const payload = variantSchema.parse(request.body);

    const { data, error } = await supabase
      .from('product_variants')
      .insert({
        product_id: id,
        name: payload.name,
        sku: cleanNullable(payload.sku),
        price_cents: payload.price_cents ?? null,
        stock: payload.stock ?? null,
        is_active: payload.is_active
      })
      .select('id,name,sku,price_cents,stock,is_active')
      .single();

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'variant_create_failed' });
    }

    return reply.code(201).send({ data });
  });

  app.patch('/api/admin/variants/:id', async (request, reply) => {
    const { id } = uuidParamsSchema.parse(request.params);
    const payload = variantSchema.partial().parse(request.body);

    const { data, error } = await supabase
      .from('product_variants')
      .update({
        ...payload,
        ...(payload.sku !== undefined ? { sku: cleanNullable(payload.sku) } : {})
      })
      .eq('id', id)
      .select('id,name,sku,price_cents,stock,is_active')
      .single();

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'variant_update_failed' });
    }

    return { data };
  });

  app.delete('/api/admin/variants/:id', async (request, reply) => {
    const { id } = uuidParamsSchema.parse(request.params);

    const { error } = await supabase
      .from('product_variants')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'variant_deactivate_failed' });
    }

    return reply.code(204).send();
  });

  app.get('/api/admin/orders', async (request, reply) => {
    const params = paginationSchema.parse(request.query);
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;

    const { data, error, count } = await supabase
      .from('orders')
      .select(
        `
          id,
          customer_name,
          customer_email,
          customer_phone,
          status,
          total_cents,
          created_at,
          items:order_items(id,product_name,variant_name,quantity,unit_price_cents,total_cents)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'orders_fetch_failed' });
    }

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count ?? 0
      }
    };
  });

  app.patch('/api/admin/orders/:id/status', async (request, reply) => {
    const { id } = uuidParamsSchema.parse(request.params);
    const payload = updateOrderStatusSchema.parse(request.body);

    const { data, error } = await supabase
      .from('orders')
      .update({ status: payload.status })
      .eq('id', id)
      .select('id,status')
      .single();

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'order_status_update_failed' });
    }

    return { data };
  });
};
