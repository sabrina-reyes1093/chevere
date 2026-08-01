import Image from "next/image";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdminUser()) redirect("/admin");
  const query = await searchParams;
  return <main className="login-page">
    <section className="login-card">
      <Image className="login-logo" src="/chevere-logo.png" alt="Chévere" width={1254} height={1254} priority />
      <p className="eyebrow">Private editorial studio</p>
      <h1>Chévere Studio</h1>
      <p>Publish stories, curate the homepage, and send the weekly edit.</p>
      {query.error && <p className="message error">The username or password was not accepted.</p>}
      <form action="/api/auth/login" method="post" className="stack">
        <label>Username<input name="username" type="text" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="primary">Sign in</button>
        <p style={{marginTop:16,fontSize:14,textAlign:'center'}}><a href="/admin/forgot-password" style={{color:'var(--brown)',textDecoration:'underline'}}>Forgot password?</a></p>
      </form>
    </section>
  </main>;
}
