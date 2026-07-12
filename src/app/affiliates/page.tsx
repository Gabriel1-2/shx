import { redirect } from "next/navigation";

/** Legacy path — affiliates = referrals program */
export default function AffiliatesRedirect() {
    redirect("/referrals");
}
