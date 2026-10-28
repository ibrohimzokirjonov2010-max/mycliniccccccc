import { clickShopHandler } from '../_lib/clickShop.js';

/** POST /api/click/prepare — Click SHOP API Prepare (action=0). */
export default function handler(req, res) {
  return clickShopHandler(req, res, 'prepare');
}
