import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * ✅ sBTC Payment Webhook Handler
 * This endpoint can be called by an off-chain indexer (like a Hiro API Webhook 
 * or a custom Chainhook) whenever an invoice payment transaction is confirmed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 2. Security Check: Validate Secret Header
  const secret = process.env.WEBHOOK_SECRET
  const incomingSecret = req.headers['x-webhook-secret']

  if (!secret || incomingSecret !== secret) {
    console.error('[Webhook] Unauthorized access attempt detected.')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { tx_id, event_type, data } = req.body

    // 3. Process the payload (Example: Invoice Paid Event)
    console.log(`[Webhook] Received ${event_type} for TX: ${tx_id}`)

    // Example logic: Update your database or send an email
    if (event_type === 'print-event' && data.contract_event_name === 'invoice-paid') {
      const invoiceId = data.value.id
      const payer = data.value.payer
      console.log(`✅ Invoice #${invoiceId} was paid by ${payer}`)

      // Add your DB update logic here (e.g., Prisma or Supabase)
    }

    // 4. Return success
    return res.status(200).json({ 
      received: true, 
      timestamp: new Date().toISOString() 
    })

  } catch (error) {
    console.error('[Webhook] Error processing payload:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}