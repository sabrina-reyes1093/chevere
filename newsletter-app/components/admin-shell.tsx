import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <>
    <header className="admin-header">
      <Link href="/admin" className="wordmark" aria-label="Chévere Studio home">
        <Image src="/chevere-logo.png" alt="Chévere" width={1254} height={1254} priority />
        <small>Studio</small>
      </Link>
      <nav className="admin-nav" aria-label="Site administration">
        <Link href="/admin">Issues</Link>
        <Link href="/admin/posts">Blog posts</Link>
        <Link href="/admin/featured-reads">Featured Reads</Link>
        <Link href="/admin/roundup">Weekly Roundup</Link>
        <Link href="/admin/site-content">Site content</Link>
        <Link href="/admin/subscribers">Subscribers</Link>
        <ThemeToggle />
        <form action="/api/auth/logout" method="post"><button className="text-button">Sign out</button></form>
      </nav>
    </header>
    <main className="admin-main">{children}</main>
  </>;
}
