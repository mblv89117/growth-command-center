import { redirect } from "next/navigation";
import { isDemoSession } from "@/lib/auth/access";
import { getAuthContext } from "@/lib/auth/api";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (await isDemoSession()) {
    redirect("/dashboard");
  }

  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role !== "platform_admin") {
    redirect("/dashboard");
  }

  return children;
}
