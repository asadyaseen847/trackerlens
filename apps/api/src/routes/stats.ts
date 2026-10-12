import { Router } from 'express';
import { notImplemented } from '../utils/httpError.js';

export const statsRouter = Router();

// TODO(Phase 3, §10): requireAuth; query string site, period, channels, device, country
// TODO(Phase 3, §10): KPIs with comparison + series by channel
statsRouter.get('/overview', notImplemented(3));
// TODO(Phase 3, §10): dimension=platform|page|campaign|country|device&limit=10
statsRouter.get('/breakdown', notImplemented(3));
// TODO(Phase 3, §9): distinct visitors seen in the last 5 minutes
statsRouter.get('/live', notImplemented(3));
// TODO(Phase 3, §10): one row per bucket and channel
statsRouter.get('/export.csv', notImplemented(3));
