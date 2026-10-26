import type { Metadata } from "next";
import { EVENT } from "@/lib/event";

export const metadata: Metadata = {
  title: "RSVP",
  description: `RSVP for the ${EVENT.name}, ${EVENT.date}, ${EVENT.venue}.`,
};

export default function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
