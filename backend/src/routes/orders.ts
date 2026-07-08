import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// ── GET all orders ─────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, restaurantId, limit = '200' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (restaurantId) where.restaurantId = restaurantId;
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET orders by restaurant ───────────────────────────────────────────────────
router.get('/restaurant/:restaurantId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: req.params.restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET single order ───────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET order tracking snapshot ────────────────────────────────────────────────
router.get('/:id/tracking', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Not found' });

    let driverLocation: { lat: number; lng: number } | null = null;
    if (order.driverId) {
      const rider = await prisma.rider.findUnique({ where: { id: order.driverId } });
      if (rider && rider.currentLat != null && rider.currentLng != null) {
        driverLocation = { lat: rider.currentLat, lng: rider.currentLng };
      }
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: order.restaurantId } });
    const restaurantLocation = restaurant && restaurant.locationLat != null && restaurant.locationLng != null
      ? { lat: restaurant.locationLat, lng: restaurant.locationLng, address: restaurant.address }
      : null;

    const customerLocation = order.deliveryLocLat != null && order.deliveryLocLng != null
      ? { lat: order.deliveryLocLat, lng: order.deliveryLocLng }
      : null;

    res.json({
      orderId: order.id,
      driverId: order.driverId,
      driverLocation,
      restaurantLocation,
      customerLocation,
      status: order.status,
      etaMinutes: order.etaMinutes,
      steps: order.statusHistory,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST create order ──────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: any = { ...req.body };

    if (!data.subtotal && Array.isArray(data.items) && data.items.length) {
      data.subtotal = data.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: data.restaurantId } });
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    data.deliveryFee = data.deliveryFee ?? restaurant.deliveryFee;
    data.tax = data.tax ?? Math.round(data.subtotal * 0.16);
    data.total = data.subtotal + data.deliveryFee + data.tax;

    // Flatten restaurant location
    data.restaurantLocLat = restaurant.locationLat ?? null;
    data.restaurantLocLng = restaurant.locationLng ?? null;
    data.restaurantLocAddr = restaurant.address;

    const statusHistory = [
      { status: 'created', message: 'Order received.', timestamp: new Date().toISOString() },
    ];

    const order = await prisma.order.create({
      data: {
        restaurantId: data.restaurantId,
        restaurantLocLat: data.restaurantLocLat,
        restaurantLocLng: data.restaurantLocLng,
        restaurantLocAddr: data.restaurantLocAddr,
        items: Array.isArray(data.items) ? data.items : [],
        subtotal: Number(data.subtotal),
        deliveryFee: Number(data.deliveryFee),
        tax: Number(data.tax),
        total: Number(data.total),
        status: data.status || 'pending',
        customerName: data.customerName || 'Customer',
        customerPhone: data.customerPhone || null,
        customerId: data.customerId || null,
        deliveryAddress: data.deliveryAddress || '',
        deliveryLocLat: data.deliveryLocLat ? Number(data.deliveryLocLat) : null,
        deliveryLocLng: data.deliveryLocLng ? Number(data.deliveryLocLng) : null,
        etaMinutes: data.etaMinutes ? Number(data.etaMinutes) : null,
        specialInstructions: data.specialInstructions || null,
        paymentMethod: data.paymentMethod || 'mpesa',
        paymentStatus: data.paymentStatus || 'pending',
        source: data.source || 'web',
        statusHistory,
      },
    });

    // Create pending OrderPayment record
    await prisma.orderPayment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        method: order.paymentMethod,
        status: 'pending',
      },
    });

    res.status(201).json(order);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH update status ────────────────────────────────────────────────────────
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Not found' });

    const history = (order.statusHistory as any[]) || [];
    history.push({ status, message: `Status updated to ${status}.`, timestamp: new Date().toISOString() });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status, statusHistory: history },
    });

    // Mark payment complete when delivered
    if (status === 'delivered') {
      await prisma.orderPayment.updateMany({
        where: { orderId: order.id },
        data: { status: 'completed' },
      });
    }

    // Free rider when delivered or cancelled
    if ((status === 'delivered' || status === 'cancelled') && order.driverId) {
      await prisma.rider.update({
        where: { id: order.driverId },
        data: { status: 'available' },
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH assign rider ─────────────────────────────────────────────────────────
router.patch('/:id/assign-rider', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { riderId } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    // Free previous rider if different
    if (order.driverId && order.driverId !== riderId) {
      await prisma.rider.update({ where: { id: order.driverId }, data: { status: 'available' } });
    }

    const newStatus = order.status === 'ready' ? 'assigned' : order.status;
    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: { driverId: riderId, status: newStatus },
    });

    await prisma.rider.update({ where: { id: riderId }, data: { status: 'busy' } });

    res.json({ order: updatedOrder, rider });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE cancel order ────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Not found' });

    const history = (order.statusHistory as any[]) || [];
    history.push({ status: 'cancelled', message: reason || 'Cancelled by admin', timestamp: new Date().toISOString() });

    await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'cancelled', cancellationReason: reason || 'Cancelled by admin', statusHistory: history },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
