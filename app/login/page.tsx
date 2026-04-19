import { getSession } from "@/lib/auth";
import { redirect }   from "next/navigation";
import LoginForm      from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/system/overview");
  return <LoginForm />;
}
