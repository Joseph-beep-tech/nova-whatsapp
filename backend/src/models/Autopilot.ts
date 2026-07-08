import { Prisma } from '@prisma/client';

export interface IAutopilot {
  id: string;
  userId: string;
  sessionId?: string | null;
  isEnabled: boolean;
  config?: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}
