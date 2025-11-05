import express from 'express';
import propertiesRoutes from './properties.js';
import paymentsRoutes from './payments.js';
import parcelTaxesRoutes from './parcelTaxes.js';

const router = express.Router();

// Use route modules
router.use('/properties', propertiesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/parcel-taxes', parcelTaxesRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Tax Assistant API'
  });
});

// Diagnóstico: listar rutas registradas
router.get('/routes', (req, res) => {
  try {
    const appRouter = req.app?._router;
    const routes = [];
    if (appRouter && Array.isArray(appRouter.stack)) {
      appRouter.stack.forEach((layer) => {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase());
          routes.push({ path: layer.route.path, methods });
        } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
          const base = layer.regexp?.toString() || '';
          layer.handle.stack.forEach((l2) => {
            if (l2.route) {
              const methods = Object.keys(l2.route.methods || {}).map(m => m.toUpperCase());
              routes.push({ path: `${base} :: ${l2.route.path}`, methods });
            }
          });
        }
      });
    }
    res.json({ count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'routes inspector failed' });
  }
});

export default router;
