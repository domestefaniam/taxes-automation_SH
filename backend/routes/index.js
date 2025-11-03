import express from 'express';
import propertiesRoutes from './properties.js';
import paymentsRoutes from './payments.js';

const router = express.Router();

// Use route modules
router.use('/properties', propertiesRoutes);
router.use('/payments', paymentsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Tax Assistant API'
  });
});

export default router;
