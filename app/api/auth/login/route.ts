// app/api/auth/login/route.ts
// POST /api/auth/login
// Validates credentials against the mock JSON store and sets a
// session cookie on success. No real password hashing — prototype only.

import { NextRequest, NextResponse } from "next/server";
import mockUsers from "@/lib/mock-users.json";
import { setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  // ── Match against mock store ─────────────────────────────────
  const user = mockUsers.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password
  );

  if (!user) {
    // Intentionally vague — don't tell the caller which field is wrong
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 }
    );
  }

  // ── Set session cookie ───────────────────────────────────────
  await setSession({
    id:    user.id,
    email: user.email,
    name:  user.name,
    role:  user.role,
  });

  return NextResponse.json({ ok: true, name: user.name });
}
