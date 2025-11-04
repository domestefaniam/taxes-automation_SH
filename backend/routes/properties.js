import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// GET /api/properties - Obtener todas las propiedades
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ properties: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/properties/:id - Obtener propiedad por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ property: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties - Crear nueva propiedad (conforme al esquema)
router.post('/', async (req, res) => {
  try {
    const {
      address,
      state,
      group_code,
      co,
      brand,
      store_number,
      zip,
      vendor_id,
      landlord,
      open_closed
    } = req.body;

    if (!address || !state) {
      return res.status(400).json({ 
        error: 'Missing required fields: address, state' 
      });
    }

    // Construir payload evitando insertar undefined
    const payload = {
      address,
      state,
      group_code,
      co,
      brand,
      store_number,
      zip,
      vendor_id,
      landlord,
      open_closed,
      created_at: new Date().toISOString()
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const { data, error } = await supabase
      .from('properties')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ property: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
