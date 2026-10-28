import { clickShopHandler } from '../_lib/clickShop.js';

/** POST /api/click/complete — Click SHOP API Complete (action=1). */
export default function handler(req, res) {
  return clickShopHandler(req, res, 'complete');
}
