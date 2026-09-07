import { redirect } from "next/navigation";

/**
 * Creating a form is a button on the list now, not a page of its own. This
 * stays only so a bookmark or a nav entry still pointing here lands on the
 * button rather than on a 404.
 */
export default function NewFormPage(): never {
  redirect("/forms");
}
