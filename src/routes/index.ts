import { Hono } from 'hono';
import { api } from './api.js';
import { cspReport } from './csp-report.js';

const router = new Hono();

// API路由
router.route('/', api);

// CSP报告路由
router.route('/csp-report', cspReport);

export { router };
