// Optional: example webhook endpoint to receive notifications from an off-chain indexer or payment re
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret || req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  // process webhook payload (e.g., invoice paid)
  console.log('webhook payload', req.body)
  res.status(200).json({ ok: true })
}
