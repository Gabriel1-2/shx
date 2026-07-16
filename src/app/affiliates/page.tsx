import { redirect } from "next/navigation";

/** Legacy path — affiliates program one-pager lives at /partners */
export default function AffiliatesRedirect() {
    redirect("/partners");
}
