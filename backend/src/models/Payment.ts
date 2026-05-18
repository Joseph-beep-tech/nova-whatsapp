import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  method: 'mpesa' | 'airtel' | 'card';
  phoneNumber: string;
  reference: string;
  status: 'pending' | 'completed' | 'failed';
  // M-Pesa specific
  merchantRequestId?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['mpesa', 'airtel', 'card'], required: true },
    phoneNumber: { type: String, default: '' },
    reference: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    merchantRequestId: { type: String, index: true },
    checkoutRequestId: { type: String, index: true },
    mpesaReceiptNumber: { type: String },
    resultCode: { type: Number },
    resultDesc: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model<IPayment>('Payment', PaymentSchema);
