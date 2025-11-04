import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// GET /api/payments - Listar pagos con información relacionada
router.get('/', async (req, res) => {
  try {
    // 1) Pagos
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (paymentsError) {
      return res.status(500).json({ error: paymentsError.message });
    }

    if (!payments || payments.length === 0) {
      return res.json({ payments: [] });
    }

    // 2) Parcel taxes relacionados
    const parcelTaxesIds = Array.from(new Set(payments.map(p => p.parcel_taxes_id).filter(Boolean)));
    let parcelTaxesById = new Map();
    if (parcelTaxesIds.length > 0) {
      const { data: parcelTaxes, error: parcelTaxesError } = await supabase
        .from('parcel_taxes')
        .select('*')
        .in('id', parcelTaxesIds);

      if (parcelTaxesError) {
        return res.status(500).json({ error: parcelTaxesError.message });
      }
      parcelTaxesById = new Map(parcelTaxes.map(pt => [pt.id, pt]));
    }

    // 3) Parcels relacionados
    const parcelIds = Array.from(new Set(
      Array.from(parcelTaxesById.values()).map(pt => pt.parcel_id).filter(Boolean)
    ));
    let parcelsById = new Map();
    if (parcelIds.length > 0) {
      const { data: parcels, error: parcelsError } = await supabase
        .from('parcels')
        .select('*')
        .in('id', parcelIds);
      if (parcelsError) {
        return res.status(500).json({ error: parcelsError.message });
      }
      parcelsById = new Map(parcels.map(pc => [pc.id, pc]));
    }

    // 4) Properties relacionadas
    const propertyIds = Array.from(new Set(
      Array.from(parcelsById.values()).map(pc => pc.property).filter(Boolean)
    ));
    let propertiesById = new Map();
    if (propertyIds.length > 0) {
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, address, landlord, open_closed')
        .in('id', propertyIds);
      if (propertiesError) {
        return res.status(500).json({ error: propertiesError.message });
      }
      propertiesById = new Map(properties.map(pr => [pr.id, pr]));
    }

    // 5) Ensamblar respuesta
    const enriched = payments.map(payment => {
      const pt = parcelTaxesById.get(payment.parcel_taxes_id);
      const parcel = pt ? parcelsById.get(pt.parcel_id) : undefined;
      const property = parcel ? propertiesById.get(parcel.property) : undefined;
      return {
        ...payment,
        parcel_taxes: pt,
        parcel,
        property
      };
    });

    res.json({ payments: enriched });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments - Crear pago y marcar bill como pagado
router.post('/', async (req, res) => {
  try {
    const {
      parcel_taxes_id,
      amount_paid,
      payment_date,
      confirmation_number,
      paid_by,
      late_fees,
      transaction_fees,
      base_amount
    } = req.body;

    if (!parcel_taxes_id || !amount_paid) {
      return res.status(400).json({ 
        error: 'Missing required fields: parcel_taxes_id, amount_paid' 
      });
    }

    const insertPayload = {
      parcel_taxes_id,
      amount_paid,
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
      confirmation_number,
      paid_by,
      late_fees,
      transaction_fees,
      base_amount,
      created_at: new Date().toISOString()
    };

    // Insertar pago
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([insertPayload])
      .select()
      .single();

    if (paymentError) {
      return res.status(500).json({ error: paymentError.message });
    }

    // Marcar la factura (parcel_taxes) como pagada
    const { error: updateError } = await supabase
      .from('parcel_taxes')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', parcel_taxes_id);

    if (updateError) {
      console.warn('Payment created but failed to update parcel_taxes status:', updateError.message);
    }

    res.status(201).json({ payment });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments/summary - Resumen basado en parcel_taxes y payments
router.get('/summary', async (req, res) => {
  try {
    const { data: bills, error: billsError } = await supabase
      .from('parcel_taxes')
      .select('amount_due, status');
    if (billsError) {
      return res.status(500).json({ error: billsError.message });
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount_paid');
    if (paymentsError) {
      return res.status(500).json({ error: paymentsError.message });
    }

    const totalDue = (bills || []).reduce((sum, b) => sum + Number(b.amount_due || 0), 0);
    const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
    const pendingAmount = totalDue - totalPaid;

    const paidBills = (bills || []).filter(b => b.status === 'paid').length;
    const pendingBills = (bills || []).filter(b => b.status === 'pending').length;

    res.json({
      summary: {
        total_due: totalDue,
        total_paid: totalPaid,
        pending_amount: pendingAmount,
        bills_count: (bills || []).length,
        paid_bills: paidBills,
        pending_bills: pendingBills
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/register - Registrar pago validando bill pendiente y calculando base_amount
router.post('/register', async (req, res) => {
  try {
    const {
      parcel_taxes_id,
      amount_paid,
      payment_date,
      confirmation_number,
      paid_by,
      late_fees = 0,
      transaction_fees = 0
    } = req.body;

    if (!parcel_taxes_id || !amount_paid) {
      return res.status(400).json({ error: 'parcel_taxes_id and amount_paid are required' });
    }

    // 1) Validar bill
    const { data: bill, error: billError } = await supabase
      .from('parcel_taxes')
      .select('*')
      .eq('id', parcel_taxes_id)
      .single();
    if (billError || !bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    if (bill.status !== 'pending') {
      return res.status(400).json({ error: `Bill status must be 'pending' (current: ${bill.status})` });
    }

    // 2) Calcular base_amount automático
    const feesTotal = Number(late_fees || 0) + Number(transaction_fees || 0);
    let base_amount = Number(amount_paid) - feesTotal;
    if (!Number.isFinite(base_amount)) base_amount = 0;
    if (base_amount < 0) base_amount = 0;

    const insertPayload = {
      parcel_taxes_id,
      amount_paid: Number(amount_paid),
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
      confirmation_number,
      paid_by,
      late_fees: Number(late_fees || 0),
      transaction_fees: Number(transaction_fees || 0),
      base_amount,
      created_at: new Date().toISOString()
    };

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([insertPayload])
      .select()
      .single();

    if (paymentError) {
      return res.status(500).json({ error: paymentError.message });
    }

    // 3) Marcar bill como pagado
    const { error: updateError } = await supabase
      .from('parcel_taxes')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', parcel_taxes_id);
    if (updateError) {
      console.warn('Payment created but failed to update bill status:', updateError.message);
    }

    res.status(201).json({ payment });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
