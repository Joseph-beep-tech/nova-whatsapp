import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
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

// GET / — balance + pricing
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let voiceCredit = await prisma.voiceCredit.findUnique({ where: { userId: req.userId } });

    if (!voiceCredit) {
      voiceCredit = await prisma.voiceCredit.create({
        data: { userId: req.userId!, balance: 0 },
      });
    }

    res.json({
      availableCredits: voiceCredit.balance,
      totalFunded: voiceCredit.balance,
      totalUsed: 0,
      transactions: [],
      pricing: PRICING,
      packages: CREDIT_PACKAGES,
    });
  } catch (error) {
    console.error('[Credits GET]', error);
    res.status(500).json({ error: 'Failed to fetch voice credits' });
  }
});

// POST /initiate — start M-Pesa STK Push payment
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

    if (phoneNumber) {
      const cleaned = phoneNumber.replace(/\s+/g, '');
      if (!/^(\+?254|0)\d{9}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Invalid phone number format. Use 0712345678 or +254712345678' });
      }
    }

    const reference = generateRef();

    if (paymentMethod === 'mpesa') {
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

      const payment = await prisma.payment.create({
        data: {
          userId: req.userId,
          amount,
          method: 'mpesa',
          reference,
          status: 'pending',
          metadata: {
            phoneNumber: normalizePhone(phoneNumber),
            merchantRequestId: mpesaResponse.MerchantRequestID,
            checkoutRequestId: mpesaResponse.CheckoutRequestID,
          },
        },
      });

      console.log(`[M-Pesa] STK Push sent → ${phoneNumber} | KES ${amount} | CheckoutReqID: ${mpesaResponse.CheckoutRequestID}`);

      return res.json({
        paymentId: payment.id,
        reference,
        status: 'pending',
        message: `STK push sent to ${phoneNumber}. Enter your M-Pesa PIN to confirm.`,
      });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: req.userId,
        amount,
        method: paymentMethod,
        reference,
        status: 'pending',
        metadata: {
          phoneNumber: phoneNumber ? normalizePhone(phoneNumber) : '',
        },
      },
    });

    res.json({
      paymentId: payment.id,
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

// GET /status/:paymentId — poll payment status
router.get('/status/:paymentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found', status: 'failed' });
    }

    if (payment.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized', status: 'failed' });
    }

    const meta = (payment.metadata as Record<string, any>) || {};

    if (payment.status === 'pending' && payment.method === 'mpesa' && meta.checkoutRequestId) {
      try {
        const queryResult = await stkQuery(meta.checkoutRequestId);
        const resultCode = String(queryResult.ResultCode);

        if (resultCode === '0') {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'completed',
              metadata: { ...meta, resultCode: 0, resultDesc: queryResult.ResultDesc },
            },
          });
          console.log(`[STK Query] Payment ${payment.reference} completed`);
        } else if (['1032', '1037', '1025', '1', '2001'].includes(resultCode)) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'failed',
              metadata: { ...meta, resultCode: Number(resultCode), resultDesc: queryResult.ResultDesc },
            },
          });
          console.log(`[STK Query] Payment ${payment.reference} failed: ${queryResult.ResultDesc}`);
        }
      } catch (queryErr: any) {
        const errData = queryErr?.response?.data;
        const errMsg = errData?.errorMessage || errData?.ResultDesc || '';
        console.log(`[STK Query] Payment ${payment.reference} still processing: ${errMsg}`);
      }

      const elapsed = Date.now() - new Date(payment.createdAt).getTime();
      if (elapsed > 180000 && payment.status === 'pending') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'failed', metadata: { ...meta, resultDesc: 'Payment timed out' } },
        });
      }
    }

    // Re-fetch updated payment
    const updatedPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!updatedPayment) return res.status(404).json({ error: 'Payment not found', status: 'failed' });
    const updatedMeta = (updatedPayment.metadata as Record<string, any>) || {};

    if (updatedPayment.status === 'completed') {
      await creditUserAccount(updatedPayment.userId!, updatedPayment.amount, updatedPayment.reference || '');

      const vc = await prisma.voiceCredit.findUnique({ where: { userId: req.userId } });
      return res.json({
        status: 'completed',
        reference: updatedPayment.reference,
        amount: updatedPayment.amount,
        mpesaReceiptNumber: updatedMeta.mpesaReceiptNumber,
        availableCredits: vc?.balance || 0,
        totalFunded: vc?.balance || 0,
        message: `KES ${updatedPayment.amount} credited successfully!`,
      });
    }

    if (updatedPayment.status === 'failed') {
      return res.json({
        status: 'failed',
        message: updatedMeta.resultDesc || 'Payment was not confirmed. Please try again.',
      });
    }

    res.json({ status: 'pending', message: 'Waiting for payment confirmation...' });
  } catch (error) {
    console.error('[Credits STATUS]', error);
    res.status(500).json({ error: 'Failed to check payment status', status: 'failed' });
  }
});

// POST /mpesa/callback — Safaricom M-Pesa callback (PUBLIC, no auth)
router.post('/mpesa/callback', async (req: Request, res: Response) => {
  try {
    const { Body } = req.body;
    if (!Body?.stkCallback) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const callback = Body.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    console.log(`[M-Pesa Callback] CheckoutReqID: ${CheckoutRequestID} | ResultCode: ${ResultCode} | ${ResultDesc}`);

    const payment = await prisma.payment.findFirst({
      where: {
        metadata: {
          path: ['checkoutRequestId'],
          equals: CheckoutRequestID,
        },
      },
    });

    if (!payment) {
      console.error(`[M-Pesa Callback] No payment found for CheckoutRequestID: ${CheckoutRequestID}`);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (payment.status !== 'pending') {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const meta = (payment.metadata as Record<string, any>) || {};

    if (ResultCode === 0) {
      let mpesaReceiptNumber: string | undefined;
      if (CallbackMetadata?.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'MpesaReceiptNumber') {
            mpesaReceiptNumber = item.Value;
          }
        }
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          metadata: { ...meta, resultCode: ResultCode, resultDesc: ResultDesc, mpesaReceiptNumber },
        },
      });

      await creditUserAccount(payment.userId!, payment.amount, payment.reference || '');

      console.log(`[M-Pesa Callback] Payment ${payment.reference} completed — KES ${payment.amount} credited to user ${payment.userId}`);
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          metadata: { ...meta, resultCode: ResultCode, resultDesc: ResultDesc },
        },
      });
      console.log(`[M-Pesa Callback] Payment ${payment.reference} failed — ${ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('[M-Pesa Callback Error]', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// Helper: credit user account (idempotent)
async function creditUserAccount(userId: string, amount: number, reference: string) {
  if (!userId) return;
  await prisma.voiceCredit.upsert({
    where: { userId },
    update: { balance: { increment: amount } },
    create: { userId, balance: amount },
  });
}

// POST /charge — deduct credits
router.post('/charge', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid charge amount' });
    }

    const voiceCredit = await prisma.voiceCredit.findUnique({ where: { userId: req.userId } });
    if (!voiceCredit) {
      return res.status(400).json({ error: 'No credit account found' });
    }

    if (voiceCredit.balance < amount) {
      return res.status(400).json({ error: 'Insufficient credits', availableCredits: voiceCredit.balance });
    }

    const updated = await prisma.voiceCredit.update({
      where: { userId: req.userId },
      data: { balance: { decrement: amount } },
    });

    res.json({
      message: 'Credits charged',
      availableCredits: updated.balance,
      totalUsed: 0,
    });
  } catch (error) {
    console.error('[Credits CHARGE]', error);
    res.status(500).json({ error: 'Failed to charge credits' });
  }
});

// GET /transactions
router.get('/transactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ transactions: payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
