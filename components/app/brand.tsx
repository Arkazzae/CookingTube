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

export const DESIGN_HOUSE_URL = "https://designhouse.me";

/** The Design House mark from designhouse.me: three squares, lime on dark and ink on paper. */
export function DesignHouseMark({ width = 20, color = "#e6ff32" }: { width?: number; color?: string }) {
  return <svg className="dh-mark" width={width} height={width * 0.7} viewBox="0 0 150.3 105.21" fill={color} aria-hidden="true">
    <rect x="73.18" width="31.73" height="31.73" rx="5.88" />
    <rect y="31.82" width="73.39" height="73.39" rx="5.88" />
    <rect x="104.8" y="31.81" width="45.5" height="45.5" rx="5.88" />
  </svg>;
}

/** "Built by Design House": the studio that designed and built CookingTube. */
export function BuiltBy({ label, className = "" }: { label: string; className?: string }) {
  return <a className={`built-by ${className}`} href={DESIGN_HOUSE_URL} target="_blank" rel="noopener noreferrer">
    <span>{label}</span><DesignHouseMark /><b>Design House</b>
  </a>;
}
