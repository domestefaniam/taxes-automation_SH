import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// GET /api/properties - Obtener todas las propiedades, con totales por año si se indica ?year
router.get('/', async (req, res) => {
  try {
    const targetYear = Number(req.query.year) || new Date().getFullYear();

    // 1) Propiedades
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('*')
      .order('id', { ascending: false });

    if (propertiesError) {
      return res.status(500).json({ error: propertiesError.message });
    }

    if (!properties || properties.length === 0) {
      return res.json({ properties: [] });
    }

    // 2) Parcels de estas propiedades
    const propertyIds = properties.map(p => p.id);
    const { data: parcels, error: parcelsError } = await supabase
      .from('parcels')
      .select('id, property')
      .in('property', propertyIds);
    if (parcelsError) {
      return res.status(500).json({ error: parcelsError.message });
    }

    const parcelIdToPropertyId = new Map((parcels || []).map(pc => [pc.id, pc.property]));
    const parcelIds = (parcels || []).map(p => p.id);

    if (parcelIds.length === 0) {
      // Sin parcels, devolver propiedades con totales en 0
      const enrichedEmpty = properties.map(p => ({
        ...p,
        year: targetYear,
        amount_due_total: 0,
        amount_paid_total: 0,
        general_status: 'complete'
      }));
      return res.json({ properties: enrichedEmpty });
    }

    // 3) Bills (parcel_taxes) del año
    const { data: bills, error: billsError } = await supabase
      .from('parcel_taxes')
      .select('id, parcel_id, year, amount_due, status')
      .in('parcel_id', parcelIds)
      .eq('year', targetYear);
    if (billsError) {
      return res.status(500).json({ error: billsError.message });
    }

    const billIds = (bills || []).map(b => b.id);

    // 4) Payments asociados a esos bills
    let payments = [];
    if (billIds.length > 0) {
      const paymentsResp = await supabase
        .from('payments')
        .select('id, parcel_taxes_id, amount_paid')
        .in('parcel_taxes_id', billIds);
      if (paymentsResp.error) {
        return res.status(500).json({ error: paymentsResp.error.message });
      }
      payments = paymentsResp.data || [];
    }

    // 5) Mapear pagos por bill
    const paidByBillId = new Map();
    for (const pay of payments) {
      const prev = paidByBillId.get(pay.parcel_taxes_id) || 0;
      paidByBillId.set(pay.parcel_taxes_id, prev + Number(pay.amount_paid || 0));
    }

    // 6) Acumular por propiedad
    const totalsByProperty = new Map();
    for (const bill of (bills || [])) {
      const propertyId = parcelIdToPropertyId.get(bill.parcel_id);
      if (!propertyId) continue;
      const prev = totalsByProperty.get(propertyId) || { due: 0, paid: 0 };
      prev.due += Number(bill.amount_due || 0);
      prev.paid += Number(paidByBillId.get(bill.id) || 0);
      totalsByProperty.set(propertyId, prev);
    }

    // 7) Enriquecer propiedades
    const enriched = properties.map(p => {
      const t = totalsByProperty.get(p.id) || { due: 0, paid: 0 };
      const general_status = t.due <= 0 ? 'complete' : (t.paid >= t.due ? 'complete' : 'pending');
      return {
        ...p,
        year: targetYear,
        amount_due_total: t.due,
        amount_paid_total: t.paid,
        general_status
      };
    });

    res.json({ properties: enriched });
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
