import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface TenantRequest extends Request {
  clinicId?: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: TenantRequest, res: Response, next: NextFunction) {
    // Extract clinic ID from JWT token (added by auth guard)
    const user = req['user'] as any;
    const clinicId = user?.clinic_id || req.headers['x-clinic-id'] as string;

    if (!clinicId) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Clinic ID is required. Please authenticate first.',
        error: 'Unauthorized',
      });
    }

    // Attach clinic ID to request for use in services
    req.clinicId = clinicId;
    next();
  }
}
