import mongoose from 'mongoose';
export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  age: number;
  gender: string;
  address: string;
  role: {
    _id: string;
    name: string;
  };
  company?: {
    _id: mongoose.Types.ObjectId;
    name?: string;
    logo?: string;
  };
  permissions?: {
    _id: string;
    name: string;
    method: string;
    apiPath: string;
    module: string;
  }[];
}
