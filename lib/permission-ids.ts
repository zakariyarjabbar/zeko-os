// lib/permission-ids.ts
// Hardcoded UUIDs for the 7 system permissions.
// Use these instead of name strings so that renaming a permission in the DB
// never breaks access control logic.

export const PERM = {
  Administrator:     "c3ea3541-3bd7-40e6-aefe-29dc1a455088",
  ChannelsManager:   "0dfd2b9c-644c-4dcd-8289-fcbeaa91d520",
  InboxView:         "03d9cadc-08e8-4a28-b14d-32594b89476f",
  InboxManager:      "fde9fd07-b1e4-44f5-88ae-782c5595a05d",
  ChangeDisplayName: "5f86f603-5c2f-427a-af5b-00af76c8ae12",
  PermissionManager: "94ac09bf-7d23-498e-94f9-19cdc0fe8617",
  RolesManager:      "2fe08c68-e975-41a6-b4bf-b0f1de420e16",
} as const;
