import { getSession } from "@/lib/auth";
import { redirect }   from "next/navigation";
import SignupForm      from "./SignupForm";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/system/overview");
  return <SignupForm />;
}
