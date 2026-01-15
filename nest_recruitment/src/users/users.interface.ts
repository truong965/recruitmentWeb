import mongoose from 'mongoose';
import { Role } from 'src/roles/schemas/role.schema';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  age: number;
  gender: string;
  address: string;
  role: Role;
}
