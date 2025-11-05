import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// Log de diagnóstico para todas las peticiones a este router
router.use((req, res, next) => {
  console.log(`[parcel-taxes] ${req.method} ${req.originalUrl}`);
  next();
});

// GET /api/parcel-taxes - Diagnóstico de ruta base
router.get('/', (req, res) => {
  res.json({ route: '/api/parcel-taxes', status: 'OK', methods: ['GET /', 'GET /pending', 'POST /', 'POST (alias)'] });
});

// GET /api/parcel-taxes/pending - Listar facturas pendientes con datos relacionados
router.get('/pending', async (req, res) => {
  try {
    // 1) Bills pendientes
    const { data: bills, error: billsError } = await supabase
      .from('parcel_taxes')
      .select('*')
      .eq('status', 'pending')
      .order('due_date', { ascending: true });

    if (billsError) {
      return res.status(500).json({ error: billsError.message });
    }

    if (!bills || bills.length === 0) {
      return res.json({ parcel_taxes: [] });
    }

    // 2) Parcels
    const parcelIds = Array.from(new Set(bills.map(b => b.parcel_id).filter(Boolean)));
    let parcelsById = new Map();
    if (parcelIds.length > 0) {
      const { data: parcels, error: parcelsError } = await supabase
        .from('parcels')
        .select('*')
        .in('id', parcelIds);
      if (parcelsError) {
        return res.status(500).json({ error: parcelsError.message });
      }
      parcelsById = new Map(parcels.map(p => [p.id, p]));
    }

    // 3) Properties
    const propertyIds = Array.from(new Set(
      Array.from(parcelsById.values()).map(p => p.property).filter(Boolean)
    ));
    let propertiesById = new Map();
    if (propertyIds.length > 0) {
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, address, landlord, open_closed, state')
        .in('id', propertyIds);
      if (propertiesError) {
        return res.status(500).json({ error: propertiesError.message });
      }
      propertiesById = new Map(properties.map(pr => [pr.id, pr]));
    }

    // 4) Ensamblar
    const enriched = bills.map(b => {
      const parcel = parcelsById.get(b.parcel_id);
      const property = parcel ? propertiesById.get(parcel.property) : undefined;
      return {
        ...b,
        parcel,
        property
      };
    });

    res.json({ parcel_taxes: enriched });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handler crear bill
async function createBill(req, res) {
  try {
    const { parcel_id, year, amount_due, due_date, status } = req.body;

    if (!parcel_id || !year || !amount_due) {
      return res.status(400).json({ 
        error: 'Missing required fields: parcel_id, year, amount_due' 
      });
    }

    // Validar que el parcel existe
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select('id, parcel_id')
      .eq('parcel_id', parcel_id)
      .single();
    if (parcelError || !parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    const parcel_taxes_id = `TAX-${new Date().getFullYear()}-${random}`;

    const payload = {
      parcel_taxes_id,
      parcel_id: parcel.id,
      year: Number(year),
      amount_due: Number(amount_due),
      due_date: due_date || null,
      status: status || 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('parcel_taxes')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ bill: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/parcel-taxes - Crear nueva factura (bill)
router.post('/', createBill);
// Alias explícito (por si algún entorno interpreta distinto la raíz)
router.post('', createBill);

export default router;



