import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// GET /api/properties - Get all properties
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ properties: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/properties/:id - Get property by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ property: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties - Create new property
router.post('/', async (req, res) => {
  try {
    const { address, owner, tax_amount, status = 'pending' } = req.body;

    if (!address || !owner || !tax_amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: address, owner, tax_amount' 
      });
    }

    const { data, error } = await supabase
      .from('properties')
      .insert([{
        address,
        owner,
        tax_amount,
        status,
        created_at: new Date().toISOString()
      }])
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
