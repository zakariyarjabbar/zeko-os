// lib/types/role.ts
// Role type used across the roles system.

import type { RoleId }     from "./ids";
import type { Permission } from "./permission";

export interface Role {
  id:          RoleId;       // branded UUID — prevents mixing with UserId etc.
  name:        string;
  description: string;
  permissions: Permission[]; // typed flags instead of bare string[]
  created_at:  string;
  userCount?:  number;       // joined on fetch
}
