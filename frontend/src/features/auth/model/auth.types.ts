export type Role = "admin" | "user";

export interface User {
  id: number;
  fname: string;
  lname: string;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
