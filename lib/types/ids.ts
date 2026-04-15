// lib/types/ids.ts
// Nominal (branded) primitive types for all database primary keys.
//
// At runtime these are plain strings — zero overhead.
// At compile time TypeScript treats each brand as a distinct type, so passing
// a ChannelId where a UserId is required is a compile error, not a silent bug.
//
// Rule: only use the `as*` casters at system entry points (DB reads, API request
// parsing). Inside business logic, always propagate the typed ID — never cast.
//
// Pattern:  type FooId = string & { readonly [FooIdBrand]: void }
// Usage:
//   function lookup(id: UserId) { ... }
//   lookup("abc")               // ← compile error: string is not UserId
//   lookup(asUserId("abc"))     // ← ok, explicit trust boundary

declare const UserIdBrand:       unique symbol;
declare const ChannelIdBrand:    unique symbol;
declare const MessageIdBrand:    unique symbol;
declare const RoleIdBrand:       unique symbol;
declare const PermissionIdBrand: unique symbol;
declare const DmIdBrand:         unique symbol;

export type UserId       = string & { readonly [UserIdBrand]:       void };
export type ChannelId    = string & { readonly [ChannelIdBrand]:    void };
export type MessageId    = string & { readonly [MessageIdBrand]:    void };
export type RoleId       = string & { readonly [RoleIdBrand]:       void };
export type PermissionId = string & { readonly [PermissionIdBrand]: void };
export type DmId         = string & { readonly [DmIdBrand]:         void };

// ── Boundary casters ──────────────────────────────────────────────────────────
// Use ONLY at system entry points (DB output, raw API input, env vars).
// Treat each call site as a trust assertion — code review should scrutinise them.

export const asUserId       = (s: string): UserId       => s as UserId;
export const asChannelId    = (s: string): ChannelId    => s as ChannelId;
export const asMessageId    = (s: string): MessageId    => s as MessageId;
export const asRoleId       = (s: string): RoleId       => s as RoleId;
export const asPermissionId = (s: string): PermissionId => s as PermissionId;
export const asDmId         = (s: string): DmId         => s as DmId;
