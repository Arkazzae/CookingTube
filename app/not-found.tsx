import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { serverDictionary } from "@/lib/locale-server";

export default async function NotFound() {
  const t = await serverDictionary();
  return <div className="page page-narrow">
    <EmptyState image="empty-favorites" title={t.notFound.title} action={<Link className="btn btn-primary" href="/">{t.notFound.home}</Link>}>
      {t.notFound.text}
    </EmptyState>
  </div>;
}
