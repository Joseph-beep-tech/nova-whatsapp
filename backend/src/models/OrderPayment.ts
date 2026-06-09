import mongoose, { Document, Schema } from 'mongoose';

export type OrderPaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface IOrderPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  amount: number;
  method: 'mpesa' | 'cash' | 'card' | 'wallet';
  status: OrderPaymentStatus;
  // M-Pesa specifics
  mpesaPhone?: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  // Generic
  transactionId?: string;
  paidAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderPaymentSchema = new Schema<IOrderPayment>(
  {
    orderId:            { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    restaurantId:       { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    customerId:         { type: Schema.Types.ObjectId, ref: 'User' },
    customerName:       { type: String, required: true },
    amount:             { type: Number, required: true },
    method:             { type: String, enum: ['mpesa','cash','card','wallet'], required: true },
    status:             { type: String, enum: ['pending','completed','failed','refunded'], default: 'pending', index: true },
    mpesaPhone:         String,
    merchantRequestId:  { type: String, index: true },
    checkoutRequestId:  { type: String, index: true },
    mpesaReceiptNumber: String,
    resultCode:         Number,
    resultDesc:         String,
    transactionId:      String,
    paidAt:             Date,
    failureReason:      String,
  },
  { timestamps: true }
);

export default mongoose.model<IOrderPayment>('OrderPayment', OrderPaymentSchema);
