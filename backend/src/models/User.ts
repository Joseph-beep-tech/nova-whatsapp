export interface IUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organization: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
