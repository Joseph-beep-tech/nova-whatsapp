import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import Order, { OrderStatus } from '../models/Order';
import Rider from '../models/Rider';
import OrderPayment from '../models/OrderPayment';
import Restaurant from '../models/Restaurant';
import mongoose from 'mongoose';

const router = Router();

function toClient(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  // Map _id → id recursively for items & statusHistory
  const mapped = {
    ...obj,
    id: obj._id?.toString(),
    _id: undefined,
    __v: undefined,
    restaurantId: obj.restaurantId?.toString(),
    driverId: obj.driverId?.toString(),
    items: (obj.items || []).map((i: any) => ({
      ...i,
      menuItemId: i.menuItemId?.toString(),
    })),
  };
  return mapped;
}

// ── GET all orders (admin) ────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, restaurantId, limit = 200 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (restaurantId) filter.restaurantId = restaurantId;
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json(orders.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET orders by restaurant ──────────────────────────────────────────────────
router.get('/restaurant/:restaurantId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ restaurantId: req.params.restaurantId })
      .sort({ createdAt: -1 });
    res.json(orders.map(toClient));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET single order ──────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(toClient(order));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET order tracking snapshot ───────────────────────────────────────────────
router.get('/:id/tracking', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });

    let driverLocation: any = null;
    if (order.driverId) {
      const rider = await Rider.findById(order.driverId);
      driverLocation = rider?.currentLocation || null;
    }

    const restaurant = await Restaurant.findById(order.restaurantId);

    res.json({
      orderId: order._id.toString(),
      driverId: order.driverId?.toString(),
      driverLocation,
      restaurantLocation: restaurant?.location || null,
      customerLocation: order.deliveryLocation || null,
      status: order.status,
      etaMinutes: order.etaMinutes,
      steps: order.statusHistory,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST create order ─────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // Calculate totals if not provided
    if (!data.subtotal && data.items?.length) {
      data.subtotal = data.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    }
    const restaurant = await Restaurant.findById(data.restaurantId);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    data.deliveryFee = data.deliveryFee ?? restaurant.deliveryFee;
    data.tax = data.tax ?? Math.round(data.subtotal * 0.16); // 16% VAT Kenya
    data.total = data.subtotal + data.deliveryFee + data.tax;
    data.restaurantLocation = restaurant.location;

    const order = new Order(data);
    // Trigger status history push
    order.statusHistory.push({
      status: 'created' as any,
      message: 'Order received.',
      timestamp: new Date(),
    });
    await order.save();

    // Create pending payment record
    await OrderPayment.create({
      orderId: order._id,
      restaurantId: order.restaurantId,
      customerName: order.customerName,
      amount: order.total,
      method: order.paymentMethod,
      status: 'pending',
    });

    res.status(201).json(toClient(order));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH update status ───────────────────────────────────────────────────────
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: OrderStatus };
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });

    order.status = status;
    // Mark payment complete when delivered
    if (status === 'delivered') {
      await OrderPayment.findOneAndUpdate(
        { orderId: order._id },
        { status: 'completed', paidAt: new Date() }
      );
    }
    // Free rider when delivered or cancelled
    if ((status === 'delivered' || status === 'cancelled') && order.driverId) {
      await Rider.findByIdAndUpdate(order.driverId, { status: 'available', currentOrderId: null });
    }
    await order.save();
    res.json(toClient(order));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH assign rider ────────────────────────────────────────────────────────
router.patch('/:id/assign-rider', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { riderId } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    // Free previous rider if different
    if (order.driverId && order.driverId.toString() !== riderId) {
      await Rider.findByIdAndUpdate(order.driverId, { status: 'available', currentOrderId: null });
    }

    order.driverId = new mongoose.Types.ObjectId(riderId);
    if (order.status === 'ready') order.status = 'assigned';
    await order.save();

    rider.status = 'busy';
    rider.currentOrderId = order._id as mongoose.Types.ObjectId;
    await rider.save();

    res.json({ order: toClient(order), rider });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE cancel order ───────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    order.status = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by admin';
    await order.save();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
