import { clickConfig } from '../_lib/click.js';
import { guard, send } from '../_lib/http.js';

/** GET /api/card/status — Click ulanganmi? ('live') yoki test rejim ('mock'). Hech qanday kalit qaytarilmaydi. */
export default async function handler(req, res) {
  if (!(await guard(req, res, { method: 'GET' }))) return;
  const cfg = clickConfig();
  send(res, 200, { ok: true, mode: cfg.configured ? 'live' : 'mock' });
}
