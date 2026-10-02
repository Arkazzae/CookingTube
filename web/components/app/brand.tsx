export function BrandMark({ size = 30 }: { size?: number }) {
  return <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <path d="M13 51C13 27 27 13 51 13c0 24-14 38-38 38Z" fill="currentColor" />
    <path d="M28 25.5v13l11-6.5Z" fill="var(--bg)" />
    <path d="M13 51l7-7" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export function Wordmark() {
  return <span className="wordmark"><BrandMark /><span>Cooking<b>Tube</b></span></span>;
}
