export function EmptyState({ image, title, children, action }: { image: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="empty-state">
    <div className="empty-photo"><img src={`/images/${image}.webp`} alt="" loading="lazy" decoding="async" /></div>
    <h2>{title}</h2>
    <p>{children}</p>
    {action}
  </section>;
}
