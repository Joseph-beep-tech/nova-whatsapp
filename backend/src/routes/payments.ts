import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { stkPush, normalizePhone } from '../services/mpesa';

const router = Router();

// GET /api/payments  — all OrderPayments (admin)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, limit = '200' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    const payments = await prisma.orderPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/restaurant/:restaurantId
router.get('/restaurant/:restaurantId', authMiddleware, async (req: Request, res: Response) => {
  try {
    // OrderPayment has no restaurantId — join via Order
    const payments = await prisma.$queryRaw<any[]>`
      SELECT op.*
      FROM "OrderPayment" op
      JOIN "Order" o ON op."orderId" = o.id
      WHERE o."restaurantId" = ${req.params.restaurantId}
      ORDER BY op."createdAt" DESC
    `;
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/order/:orderId
router.get('/order/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const payment = await prisma.orderPayment.findFirst({ where: { orderId: req.params.orderId } });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/mpesa/stk  — initiate STK push for an order
router.post('/mpesa/stk', async (req: Request, res: Response) => {
  try {
    const { orderId, phone } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const payment = await prisma.orderPayment.findFirst({ where: { orderId } });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    const result = await stkPush({
      phoneNumber: phone,
      amount: order.total,
      accountReference: `NovaGo-${order.id.slice(-6).toUpperCase()}`,
      transactionDesc: `Order payment for ${order.customerName}`,
    });

    // Store checkout request ID in reference field
    await prisma.orderPayment.update({
      where: { id: payment.id },
      data: { reference: result.CheckoutRequestID },
    });

    res.json({
      success: true,
      checkoutRequestId: result.CheckoutRequestID,
      message: 'STK push sent to ' + phone,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/mpesa/callback  — M-Pesa callback
router.post('/mpesa/callback', async (req: Request, res: Response) => {
  try {
    const { Body } = req.body;
    const stkCallback = Body?.stkCallback;
    if (!stkCallback) return res.json({ ResultCode: 0 });

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    // Find payment by checkoutRequestId stored in reference
    const payment = await prisma.orderPayment.findFirst({
      where: { reference: CheckoutRequestID },
    });
    if (!payment) return res.json({ ResultCode: 0 });

    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const getVal = (name: string) => items.find((i: any) => i.Name === name)?.Value;
      const mpesaReceiptNumber = getVal('MpesaReceiptNumber');

      await prisma.orderPayment.update({
        where: { id: payment.id },
        data: { status: 'completed', reference: mpesaReceiptNumber || CheckoutRequestID },
      });
      // Update order payment status
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'paid' },
      });
    } else {
      await prisma.orderPayment.update({ where: { id: payment.id }, data: { status: 'failed' } });
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'failed' },
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err: any) {
    console.error('M-Pesa callback error:', err);
    res.json({ ResultCode: 0 });
  }
});

// PATCH /api/payments/:id/status  — manual override (admin)
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const payment = await prisma.orderPayment.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(payment);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
});

export default router;
