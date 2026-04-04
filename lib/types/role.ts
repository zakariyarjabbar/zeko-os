// lib/types/role.ts
// Role type used across the roles system.

export interface Role {
  id:          string;
  name:        string;
  description: string;
  permissions: string[];
  created_at:  string;
  userCount?:  number; // joined on fetch
}
