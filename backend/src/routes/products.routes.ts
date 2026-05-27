import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';

const listProductsSchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24)
});

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160)
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/categories', async (_, reply) => {
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

  app.get('/api/products', async (request, reply) => {
    const params = listProductsSchema.parse(request.query);
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;
    const categoryJoin = params.category
      ? 'category:categories!inner(id,name,slug)'
      : 'category:categories(id,name,slug)';

    let query = supabase
      .from('products')
      .select(
        `
          id,
          name,
          slug,
          description,
          price_cents,
          compare_at_price_cents,
          image_url,
          stock,
          is_active,
          created_at,
          ${categoryJoin},
          variants:product_variants(id,name,sku,price_cents,stock,is_active)
        `,
        { count: 'exact' }
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (params.category) {
      query = query.eq('categories.slug', params.category);
    }

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

  app.get('/api/products/:slug', async (request, reply) => {
    const { slug } = slugParamsSchema.parse(request.params);

    const { data, error } = await supabase
      .from('products')
      .select(
        `
          id,
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
          category:categories(id,name,slug),
          variants:product_variants(id,name,sku,price_cents,stock,is_active)
        `
      )
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return reply.code(404).send({ error: 'product_not_found' });
      }

      app.log.error(error);
      return reply.code(500).send({ error: 'product_fetch_failed' });
    }

    return { data };
  });
};
