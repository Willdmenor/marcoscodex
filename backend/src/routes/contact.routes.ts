import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(30).optional(),
  message: z.string().trim().min(10).max(4000)
});

export const contactRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/contact', async (request, reply) => {
    const payload = contactSchema.parse(request.body);

    const { error } = await supabase.from('contact_messages').insert({
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone ?? null,
      message: payload.message
    });

    if (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'contact_create_failed' });
    }

    return reply.code(201).send({ ok: true });
  });
};
