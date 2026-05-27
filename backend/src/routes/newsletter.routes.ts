import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';

const newsletterSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120).optional(),
  source: z.string().trim().min(1).max(80).default('website')
});

export const newsletterRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/newsletter', async (request, reply) => {
    const payload = newsletterSchema.parse(request.body);

    const { error } = await supabase.from('newsletter_subscribers').upsert(
      {
        email: payload.email.toLowerCase(),
        name: payload.name ?? null,
        source: payload.source
      },
      { onConflict: 'email' }
    );

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'newsletter_subscribe_failed' });
    }

    return reply.code(201).send({ ok: true });
  });
};
