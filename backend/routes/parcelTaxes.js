import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

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

export default router;



