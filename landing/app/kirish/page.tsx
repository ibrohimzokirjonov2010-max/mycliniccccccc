import { redirect } from "next/navigation";
import { crmLoginUrl } from "@/lib/utils";

export default function LoginPage() {
  redirect(crmLoginUrl());
}
