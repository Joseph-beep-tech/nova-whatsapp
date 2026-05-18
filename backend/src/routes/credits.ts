import { Router, Request, Response } from 'express';
import VoiceCredit from '../models/VoiceCredit';
import Payment from '../models/Payment';
import { authMiddleware } from '../middleware/auth';
import { stkPush, stkQuery, normalizePhone } from '../services/mpesa';

interface AuthRequest extends Request {
  userId?: string;
  body: any;
  params: any;
}

const router = Router();

// Pricing
const PRICING = {
  voiceCallPerMinute: 4.0,
  whatsappPerMessage: 0.5,
  phoneNumberPurchase: 25.0,
};

const CREDIT_PACKAGES = [
  { amount: 100, credits: 100, label: '100 KES', description: '25 min calls or 200 messages' },
  { amount: 500, credits: 500, label: '500 KES', description: '125 min calls or 1,000 messages' },
  { amount: 1000, credits: 1000, label: '1,000 KES', description: '250 min calls or 2,000 messages' },
  { amount: 2500, credits: 2500, label: '2,500 KES', description: '625 min calls or 5,000 messages' },
  { amount: 5000, credits: 5000, label: '5,000 KES', description: '1,250 min calls or 10,000 messages' },
];

function generateRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = '';
  for (let i = 0; i < 10; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

// ---------------------------------------------------------------------------
// GET / — balance + transactions + pricing
// ---------------------------------------------------------------------------
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let voiceCredit = await VoiceCredit.findOne({ userId: req.userId });

    if (!voiceCredit) {
      voiceCredit = new VoiceCredit({
        userId: req.userId,
        availableCredits: 0,
        totalFunded: 0,
        totalUsed: 0,
        transactions: [],
      });
      await voiceCredit.save();
    }

    res.json({
      availableCredits: voiceCredit.availableCredits,
      totalFunded: voiceCredit.totalFunded,
      totalUsed: voiceCredit.totalUsed,
      transactions: voiceCredit.transactions,
      pricing: PRICING,
      packages: CREDIT_PACKAGES,
    });
  } catch (error) {
    console.error('[Credits GET]', error);
    res.status(500).json({ error: 'Failed to fetch voice credits' });
  }
});

// ---------------------------------------------------------------------------
// POST /initiate — start M-Pesa STK Push payment
// ---------------------------------------------------------------------------
router.post('/initiate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, paymentMethod, phoneNumber } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Select a payment method' });
    }
    if ((paymentMethod === 'mpesa' || paymentMethod === 'airtel') && !phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required for mobile payment' });
    }

    // Validate phone format
    if (phoneNumber) {
      const cleaned = phoneNumber.replace(/\s+/g, '');
      if (!/^(\+?254|0)\d{9}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Invalid phone number format. Use 0712345678 or +254712345678' });
      }
    }

    const reference = generateRef();

    if (paymentMethod === 'mpesa') {
      // ---- Real M-Pesa STK Push ----
      const mpesaResponse = await stkPush({
        phoneNumber,
        amount,
        accountReference: reference,
        transactionDesc: `Azizi Credits - KES ${amount}`,
      });

      if (mpesaResponse.ResponseCode !== '0') {
        return res.status(400).json({
          error: mpesaResponse.ResponseDescription || 'Failed to initiate M-Pesa payment',
        });
      }

      // Persist payment to DB
      const payment = await Payment.create({
        userId: req.userId,
        amount,
        method: 'mpesa',
        phoneNumber: normalizePhone(phoneNumber),
        reference,
        status: 'pending',
        merchantRequestId: mpesaResponse.MerchantRequestID,
        checkoutRequestId: mpesaResponse.CheckoutRequestID,
      });

      console.log(`[M-Pesa] STK Push sent → ${phoneNumber} | KES ${amount} | CheckoutReqID: ${mpesaResponse.CheckoutRequestID}`);

      return res.json({
        paymentId: payment._id,
        reference,
        status: 'pending',
        message: `STK push sent to ${phoneNumber}. Enter your M-Pesa PIN to confirm.`,
      });
    }

    // Fallback for non-mpesa methods (airtel / card) — placeholder
    const payment = await Payment.create({
      userId: req.userId,
      amount,
      method: paymentMethod,
      phoneNumber: phoneNumber ? normalizePhone(phoneNumber) : '',
      reference,
      status: 'pending',
    });

    res.json({
      paymentId: payment._id,
      reference,
      status: 'pending',
      message:
        paymentMethod === 'airtel'
          ? `Payment request sent to ${phoneNumber}. Enter your Airtel Money PIN to confirm.`
          : 'Processing card payment...',
    });
  } catch (error: any) {
    console.error('[Credits INITIATE]', error?.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// ---------------------------------------------------------------------------
// GET /status/:paymentId — poll payment status
// ---------------------------------------------------------------------------
router.get('/status/:paymentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found', status: 'failed' });
    }

    if (payment.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized', status: 'failed' });
    }

    // If still pending, try querying Safaricom for updated status
    if (payment.status === 'pending' && payment.method === 'mpesa' && payment.checkoutRequestId) {
      try {
        const queryResult = await stkQuery(payment.checkoutRequestId);
        const resultCode = String(queryResult.ResultCode);

        if (resultCode === '0') {
          // Successful payment
          payment.status = 'completed';
          payment.resultCode = 0;
          payment.resultDesc = queryResult.ResultDesc;
          await payment.save();
          console.log(`[STK Query] Payment ${payment.reference} completed`);
        } else if (['1032', '1037', '1025', '1', '2001'].includes(resultCode)) {
          // Definite failures: 1032=cancelled, 1037=timeout, 1025=limit, 1=insufficient, 2001=wrong pin
          payment.status = 'failed';
          payment.resultCode = Number(resultCode);
          payment.resultDesc = queryResult.ResultDesc;
          await payment.save();
          console.log(`[STK Query] Payment ${payment.reference} failed: ${queryResult.ResultDesc}`);
        }
        // Any other code — keep as pending (still processing)
      } catch (queryErr: any) {
        // Safaricom returns HTTP errors when transaction is still processing — keep pending
        const errData = queryErr?.response?.data;
        const errMsg = errData?.errorMessage || errData?.ResultDesc || '';
        console.log(`[STK Query] Payment ${payment.reference} still processing: ${errMsg}`);
      }

      // Check timeout (3 minutes)
      const elapsed = Date.now() - new Date(payment.createdAt).getTime();
      if (elapsed > 180000 && payment.status === 'pending') {
        payment.status = 'failed';
        payment.resultDesc = 'Payment timed out';
        await payment.save();
      }
    }

    // If completed, credit the account
    if (payment.status === 'completed') {
      await creditUserAccount(payment.userId.toString(), payment);

      return res.json({
        status: 'completed',
        reference: payment.reference,
        amount: payment.amount,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        availableCredits: (await VoiceCredit.findOne({ userId: req.userId }))?.availableCredits || 0,
        totalFunded: (await VoiceCredit.findOne({ userId: req.userId }))?.totalFunded || 0,
        message: `KES ${payment.amount} credited successfully!`,
      });
    }

    if (payment.status === 'failed') {
      return res.json({
        status: 'failed',
        message: payment.resultDesc || 'Payment was not confirmed. Please try again.',
      });
    }

    // Still pending
    res.json({
      status: 'pending',
      message: 'Waiting for payment confirmation...',
    });
  } catch (error) {
    console.error('[Credits STATUS]', error);
    res.status(500).json({ error: 'Failed to check payment status', status: 'failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /mpesa/callback — Safaricom M-Pesa callback (PUBLIC, no auth)
// ---------------------------------------------------------------------------
router.post('/mpesa/callback', async (req: Request, res: Response) => {
  try {
    const { Body } = req.body;
    if (!Body?.stkCallback) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const callback = Body.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    console.log(`[M-Pesa Callback] CheckoutReqID: ${CheckoutRequestID} | ResultCode: ${ResultCode} | ${ResultDesc}`);

    const payment = await Payment.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!payment) {
      console.error(`[M-Pesa Callback] No payment found for CheckoutRequestID: ${CheckoutRequestID}`);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (payment.status !== 'pending') {
      // Already processed (idempotency)
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    payment.resultCode = ResultCode;
    payment.resultDesc = ResultDesc;

    if (ResultCode === 0) {
      // Successful payment — extract metadata
      payment.status = 'completed';

      if (CallbackMetadata?.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'MpesaReceiptNumber') {
            payment.mpesaReceiptNumber = item.Value;
          }
        }
      }

      await payment.save();

      // Credit user account
      await creditUserAccount(payment.userId.toString(), payment);

      console.log(`[M-Pesa Callback] Payment ${payment.reference} completed — KES ${payment.amount} credited to user ${payment.userId}`);
    } else {
      payment.status = 'failed';
      await payment.save();
      console.log(`[M-Pesa Callback] Payment ${payment.reference} failed — ${ResultDesc}`);
    }

    // Safaricom expects a success acknowledgement
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('[M-Pesa Callback Error]', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// ---------------------------------------------------------------------------
// Helper: credit user account (idempotent via reference check)
// ---------------------------------------------------------------------------
async function creditUserAccount(userId: string, payment: any) {
  let voiceCredit = await VoiceCredit.findOne({ userId });
  if (!voiceCredit) {
    voiceCredit = new VoiceCredit({
      userId,
      availableCredits: 0,
      totalFunded: 0,
      totalUsed: 0,
      transactions: [],
    });
  }

  // Idempotency: check if already credited
  const alreadyCredited = voiceCredit.transactions.some(
    (tx: any) => tx.reference === payment.reference && tx.type === 'fund',
  );
  if (alreadyCredited) return;

  const newBalance = voiceCredit.availableCredits + payment.amount;
  voiceCredit.availableCredits = newBalance;
  voiceCredit.totalFunded += payment.amount;
  voiceCredit.transactions.push({
    type: 'fund',
    amount: payment.amount,
    balance: newBalance,
    description: `Funded via M-Pesa${payment.phoneNumber ? ` (${payment.phoneNumber})` : ''}${payment.mpesaReceiptNumber ? ` — Receipt: ${payment.mpesaReceiptNumber}` : ''}`,
    channel: payment.method,
    phoneNumber: payment.phoneNumber || undefined,
    reference: payment.reference,
    status: 'completed',
    date: new Date(),
  } as any);
  await voiceCredit.save();
}

// ---------------------------------------------------------------------------
// POST /charge — deduct credits (used by call/whatsapp systems)
// ---------------------------------------------------------------------------
router.post('/charge', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, channel, phoneNumber, duration, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid charge amount' });
    }

    const voiceCredit = await VoiceCredit.findOne({ userId: req.userId });
    if (!voiceCredit) {
      return res.status(400).json({ error: 'No credit account found' });
    }

    if (voiceCredit.availableCredits < amount) {
      return res.status(400).json({ error: 'Insufficient credits', availableCredits: voiceCredit.availableCredits });
    }

    const newBalance = voiceCredit.availableCredits - amount;
    voiceCredit.availableCredits = newBalance;
    voiceCredit.totalUsed += amount;
    voiceCredit.transactions.push({
      type: 'charge',
      amount,
      balance: newBalance,
      description: description || `Charged for ${channel}`,
      channel: channel || 'system',
      phoneNumber,
      duration,
      reference: generateRef(),
      status: 'completed',
      date: new Date(),
    } as any);

    await voiceCredit.save();

    res.json({
      message: 'Credits charged',
      availableCredits: voiceCredit.availableCredits,
      totalUsed: voiceCredit.totalUsed,
    });
  } catch (error) {
    console.error('[Credits CHARGE]', error);
    res.status(500).json({ error: 'Failed to charge credits' });
  }
});

// ---------------------------------------------------------------------------
// GET /transactions
// ---------------------------------------------------------------------------
router.get('/transactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const voiceCredit = await VoiceCredit.findOne({ userId: req.userId });
    if (!voiceCredit) {
      return res.json({ transactions: [] });
    }
    res.json({ transactions: voiceCredit.transactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
