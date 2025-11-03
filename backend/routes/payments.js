import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// GET /api/payments - Get all payments
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        properties (
          address,
          owner
        )
      `)
      .order('payment_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ payments: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments - Create new payment
router.post('/', async (req, res) => {
  try {
    const { property_id, amount, payment_date, notes } = req.body;

    if (!property_id || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: property_id, amount' 
      });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        property_id,
        amount,
        payment_date: payment_date || new Date().toISOString(),
        notes,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (paymentError) {
      return res.status(500).json({ error: paymentError.message });
    }

    // Update property status to paid
    const { error: updateError } = await supabase
      .from('properties')
      .update({ 
        status: 'paid',
        last_paid: payment_date || new Date().toISOString()
      })
      .eq('id', property_id);

    if (updateError) {
      console.warn('Payment created but failed to update property status:', updateError.message);
    }

    res.status(201).json({ payment });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments/summary - Get payment summary
router.get('/summary', async (req, res) => {
  try {
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('tax_amount, status');

    if (propertiesError) {
      return res.status(500).json({ error: propertiesError.message });
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount');

    if (paymentsError) {
      return res.status(500).json({ error: paymentsError.message });
    }

    const totalTax = properties.reduce((sum, p) => sum + p.tax_amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const pending = totalTax - totalPaid;

    res.json({
      summary: {
        total_tax: totalTax,
        total_paid: totalPaid,
        pending_amount: pending,
        properties_count: properties.length,
        paid_properties: properties.filter(p => p.status === 'paid').length,
        pending_properties: properties.filter(p => p.status === 'pending').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
