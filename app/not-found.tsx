import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";

export default function NotFound() {
  return <div className="page page-narrow">
    <EmptyState image="empty-favorites" title="Tej strony nie ma w menu" action={<Link className="btn btn-primary" href="/">Wróć na start</Link>}>
      Adres mógł się zmienić. Zacznij od strony głównej.
    </EmptyState>
  </div>;
}
