import mongoose from 'mongoose';

export interface IUser {
  _id: mongoose.Schema.Types.ObjectId;
  name: string;
  email: string;
  age: number;
  gender: string;
  address: string;
  role: string;
}
