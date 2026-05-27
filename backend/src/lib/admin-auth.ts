import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers['x-admin-api-key'];
  const providedKey = Array.isArray(key) ? key[0] : key;

  if (!providedKey || !safeEqual(providedKey, env.ADMIN_API_KEY)) {
    return reply.code(401).send({ error: 'admin_auth_required' });
  }
}
