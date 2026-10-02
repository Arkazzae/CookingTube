"use client";
import { forwardRef } from "react";
import { useRouter } from "next/navigation";

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

/**
 * A plain link with client-side navigation. vinext 1.0.0-beta.5's next/link loads a navigation chunk without
 * navigateClientSide in production, so clicks threw; router.push uses the working path. Modified clicks, other
 * targets and downloads keep the browser's default behaviour.
 */
const AppLink = forwardRef<HTMLAnchorElement, Props>(function AppLink({ href, onClick, ...rest }, ref) {
  const router = useRouter();
  return <a ref={ref} href={href} {...rest} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((rest.target && rest.target !== "_self") || rest.download !== undefined) return;
    event.preventDefault();
    router.push(href);
  }} />;
});

export default AppLink;
