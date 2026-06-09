import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import OrderPayment from '../models/OrderPayment';
import Order from '../models/Order';
import mpesaService from '../services/mpesa';

const router = Router();

function toClient(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id?.toString(),
    _id: undefined,
    __v: undefined,
    orderId: obj.orderId?.toString(),
    restaurantId: obj.restaurantId?.toString(),
  };
}

// GET /api/payments  — all payments (admin)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, restaurantId, limit = 200 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (restaurantId) filter.restaurantId = restaurantId;
    const payments = await OrderPayment.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json(payments.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/restaurant/:restaurantId
router.get('/restaurant/:restaurantId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const payments = await OrderPayment.find({ restaurantId: req.params.restaurantId })
      .sort({ createdAt: -1 });
    res.json(payments.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/order/:orderId
router.get('/order/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const payment = await OrderPayment.findOne({ orderId: req.params.orderId });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(toClient(payment));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/mpesa/stk  — initiate STK push for an order
router.post('/mpesa/stk', async (req: Request, res: Response) => {
  try {
    const { orderId, phone } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const payment = await OrderPayment.findOne({ orderId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    const result = await mpesaService.initiateSTKPush(
      phone,
      order.total,
      `NovaGo-${order._id.toString().slice(-6).toUpperCase()}`,
      `Order payment for ${order.customerName}`
    );

    payment.mpesaPhone = phone;
    payment.merchantRequestId = result.MerchantRequestID;
    payment.checkoutRequestId = result.CheckoutRequestID;
    await payment.save();

    res.json({ success: true, checkoutRequestId: result.CheckoutRequestID, message: 'STK push sent to ' + phone });
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
    const payment = await OrderPayment.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!payment) return res.json({ ResultCode: 0 });

    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const getVal = (name: string) => items.find((i: any) => i.Name === name)?.Value;
      payment.status = 'completed';
      payment.mpesaReceiptNumber = getVal('MpesaReceiptNumber');
      payment.paidAt = new Date();

      // Mark order payment status
      await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'paid' });
    } else {
      payment.status = 'failed';
      payment.failureReason = ResultDesc;
      await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'failed' });
    }
    payment.resultCode = ResultCode;
    payment.resultDesc = ResultDesc;
    await payment.save();

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
    const payment = await OrderPayment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!payment) return res.status(404).json({ message: 'Not found' });
    res.json(toClient(payment));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
