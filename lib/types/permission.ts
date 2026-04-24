// lib/types/permission.ts

export type SystemFlag =
  | "Administrator"        // unrestricted — bypasses every check
  | "channels-manager"     // view + delete messages in ALL channels
  | "inbox-view"           // read-only access to the contact inbox
  | "inbox-manager"        // full inbox management: view, delete, respond
  | "change-display-name"  // change any user's display name, username, password
  | "permission-manager"   // manage access_flags and permission definitions
  | "roles-manager";       // manage roles and role assignments

export type ChannelAction =
  | "view"
  | "send"
  | "delete-msg"
  | "manage";

export type ChannelPermission = `${ChannelAction}:${string}`;

export type Permission = SystemFlag | ChannelPermission;

export function isSystemFlag(p: Permission): p is SystemFlag {
  return !p.includes(":");
}

export function isChannelPermission(p: Permission): p is ChannelPermission {
  return p.includes(":");
}

export function channelPerm(action: ChannelAction, channelId: string): ChannelPermission {
  return `${action}:${channelId}`;
}

export function parseChannelPerm(p: ChannelPermission): { action: ChannelAction; channelId: string } {
  const colon = p.indexOf(":");
  return { action: p.slice(0, colon) as ChannelAction, channelId: p.slice(colon + 1) };
}

export const asPermission = (s: string): Permission => s as Permission;
