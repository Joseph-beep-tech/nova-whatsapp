import { Prisma } from '@prisma/client';

export interface IPayment {
  id: string;
  orderId?: string | null;
  userId?: string | null;
  amount: number;
  method: string;
  status: string;
  reference?: string | null;
  metadata?: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}
