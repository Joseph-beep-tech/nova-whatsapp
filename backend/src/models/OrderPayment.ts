export type OrderPaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface IOrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  status: string;
  reference?: string | null;
  createdAt: Date;
}
