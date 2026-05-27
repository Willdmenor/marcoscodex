import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import type { Database, Json } from '../types/database.js';

type ProductRow = Database['public']['Tables']['products']['Row'];
type VariantRow = Database['public']['Tables']['product_variants']['Row'];

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(8).max(30).optional()
  }),
  shippingAddress: z.record(z.string(), z.any()).optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .min(1)
    .max(50)
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/orders', async (request, reply) => {
    const payload = createOrderSchema.parse(request.body);
    const productIds = [...new Set(payload.items.map((item) => item.productId))];
    const variantIds = [
      ...new Set(payload.items.map((item) => item.variantId).filter(Boolean))
    ] as string[];

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id,name,price_cents,stock,is_active')
      .in('id', productIds);

    if (productsError) {
      app.log.error(productsError);
      return reply.code(500).send({ error: 'order_products_fetch_failed' });
    }

    const variantsResult =
      variantIds.length > 0
        ? await supabase
            .from('product_variants')
            .select('id,product_id,name,price_cents,stock,is_active')
            .in('id', variantIds)
        : { data: [] as VariantRow[], error: null };

    if (variantsResult.error) {
      app.log.error(variantsResult.error);
      return reply.code(500).send({ error: 'order_variants_fetch_failed' });
    }

    const productMap = new Map(
      (products as ProductRow[]).map((product) => [product.id, product])
    );
    const variantMap = new Map(
      (variantsResult.data as VariantRow[]).map((variant) => [variant.id, variant])
    );

    const items = payload.items.map((item) => {
      const product = productMap.get(item.productId);

      if (!product || !product.is_active) {
        throw httpError(404, `Product ${item.productId} is unavailable`);
      }

      const variant = item.variantId ? variantMap.get(item.variantId) : null;

      if (item.variantId && (!variant || !variant.is_active || variant.product_id !== product.id)) {
        throw httpError(404, `Variant ${item.variantId} is unavailable`);
      }

      const availableStock = variant?.stock ?? product.stock;

      if (availableStock !== null && availableStock < item.quantity) {
        throw httpError(409, `Not enough stock for ${product.name}`);
      }

      const unitPriceCents = variant?.price_cents ?? product.price_cents;

      return {
        product,
        variant,
        quantity: item.quantity,
        unitPriceCents,
        totalCents: unitPriceCents * item.quantity
      };
    });

    const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: payload.customer.name,
        customer_email: payload.customer.email.toLowerCase(),
        customer_phone: payload.customer.phone ?? null,
        shipping_address: (payload.shippingAddress ?? null) as Json | null,
        notes: payload.notes ?? null,
        total_cents: totalCents,
        status: 'pending'
      })
      .select('id,status,total_cents,created_at')
      .single();

    if (orderError || !order) {
      app.log.error(orderError);
      return reply.code(500).send({ error: 'order_create_failed' });
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      variant_id: item.variant?.id ?? null,
      product_name: item.product.name,
      variant_name: item.variant?.name ?? null,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      total_cents: item.totalCents
    }));

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (orderItemsError) {
      app.log.error(orderItemsError);
      return reply.code(500).send({ error: 'order_items_create_failed' });
    }

    return reply.code(201).send({ data: order });
  });
};
