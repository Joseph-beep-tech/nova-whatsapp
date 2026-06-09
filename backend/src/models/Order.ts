import mongoose, { Document, Schema } from 'mongoose';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready'
  | 'assigned' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

export interface IOrderItem {
  menuItemId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface ITrackingStep {
  status: OrderStatus | 'created';
  message: string;
  timestamp: Date;
}

export interface IOrder extends Document {
  restaurantId: mongoose.Types.ObjectId;
  restaurantLocation?: { lat: number; lng: number; address?: string };
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string;
  customerId?: mongoose.Types.ObjectId;
  deliveryAddress: string;
  deliveryLocation?: { lat: number; lng: number };
  driverId?: mongoose.Types.ObjectId;
  etaMinutes?: number;
  specialInstructions?: string;
  paymentMethod: 'mpesa' | 'cash' | 'card' | 'wallet';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  statusHistory: ITrackingStep[];
  source: 'web' | 'whatsapp' | 'voice' | 'app' | 'pos';
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem' },
  name:       { type: String, required: true },
  quantity:   { type: Number, required: true, min: 1 },
  price:      { type: Number, required: true },
  notes:      String,
}, { _id: false });

const TrackingStepSchema = new Schema<ITrackingStep>({
  status:    { type: String, required: true },
  message:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const OrderSchema = new Schema<IOrder>(
  {
    restaurantId:       { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    restaurantLocation: { lat: Number, lng: Number, address: String },
    items:              { type: [OrderItemSchema], required: true },
    subtotal:           { type: Number, required: true },
    deliveryFee:        { type: Number, required: true, default: 0 },
    tax:                { type: Number, required: true, default: 0 },
    total:              { type: Number, required: true },
    status:             {
      type: String,
      enum: ['pending','confirmed','preparing','ready','assigned','picked_up','on_the_way','delivered','cancelled'],
      default: 'pending',
      index: true,
    },
    customerName:       { type: String, required: true },
    customerPhone:      String,
    customerId:         { type: Schema.Types.ObjectId, ref: 'User' },
    deliveryAddress:    { type: String, required: true },
    deliveryLocation:   { lat: Number, lng: Number },
    driverId:           { type: Schema.Types.ObjectId, ref: 'Rider' },
    etaMinutes:         Number,
    specialInstructions:String,
    paymentMethod:      { type: String, enum: ['mpesa','cash','card','wallet'], default: 'mpesa' },
    paymentStatus:      { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' },
    statusHistory:      { type: [TrackingStepSchema], default: [] },
    source:             { type: String, enum: ['web','whatsapp','voice','app','pos'], default: 'web' },
    cancellationReason: String,
  },
  { timestamps: true }
);

// Auto-push to statusHistory on status change
OrderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const messages: Record<string, string> = {
      pending:    'Order placed and waiting for confirmation.',
      confirmed:  'Order confirmed by the restaurant.',
      preparing:  'Your order is being prepared.',
      ready:      'Order is ready for pickup.',
      assigned:   'A rider has been assigned.',
      picked_up:  'Rider has picked up your order.',
      on_the_way: 'Your order is on the way!',
      delivered:  'Order delivered successfully.',
      cancelled:  'Order has been cancelled.',
    };
    this.statusHistory.push({
      status: this.status,
      message: messages[this.status] || this.status,
      timestamp: new Date(),
    });
  }
  next();
});

export default mongoose.model<IOrder>('Order', OrderSchema);
