'use client';

import { useState, type FormEvent } from 'react';
import { createAuthClient } from 'better-auth/react';
import { ArrowRight, GitBranch, Layers3, ShieldCheck } from 'lucide-react';
import { brand } from '@/lib/types';
import { authenticationErrorMessage } from '@/lib/auth-error';
import { ErrorMessage, Field, Logo } from './ui';

export const authClient = createAuthClient();
export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const email = String(data.get('email'));
      const password = String(data.get('password'));
      const result = register
        ? await authClient.signUp.email({ email, password, name: String(data.get('name')) })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(authenticationErrorMessage(result.error));
        return;
      }
      onAuthenticated();
    } catch (err) {
      setError(authenticationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Logo />
        <div className="auth-editorial">
          <span className="eyebrow">A CLEARER WAY TO WORK</span>
          <h1>
            Great work.
            <br />
            All connected<span>.</span>
          </h1>
          <p>
            See the whole picture. Connect your projects, people, and priorities in one focused
            workspace.
          </p>
          <div className="auth-features">
            <span>
              <Layers3 size={17} /> A place for every project
            </span>
            <span>
              <GitBranch size={17} /> Clarity in every connection
            </span>
            <span>
              <ShieldCheck size={17} /> Your data. Your workspace.
            </span>
          </div>
        </div>
        <div className="auth-art" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="orbit-node orbit-main">
            <Logo compact />
            <span>
              CONNECTED
              <br />
              BY DESIGN
            </span>
          </div>
          <span className="orbit-node orbit-one">
            PROJECTS <i />
          </span>
          <span className="orbit-node orbit-two">
            IDEAS <i />
          </span>
          <span className="orbit-node orbit-three">
            MOMENTUM <i />
          </span>
        </div>
        <footer>
          THE VISUAL OPERATING SYSTEM FOR MODERN WORK <span>01 — ∞</span>
        </footer>
      </section>
      <section className="auth-form-section">
        <div className="auth-mobile-brand">
          <Logo />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h2>{register ? 'Make room for better work.' : 'Welcome back.'}</h2>
          <p>
            {register
              ? 'Create your account. Build your first workspace.'
              : 'Step into your workspace and keep things moving.'}
          </p>
          <form onSubmit={submit} className="stack-form">
            {register && (
              <Field label="Full name">
                <input
                  name="name"
                  className="input"
                  required
                  autoComplete="name"
                  maxLength={100}
                  placeholder="Alex Morgan"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                className="input"
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </Field>
            <Field
              label="Password"
              hint={register ? 'At least 12 characters. Use a unique password.' : undefined}
            >
              <input
                name="password"
                type="password"
                className="input"
                required
                minLength={register ? 12 : 1}
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="Enter your password"
              />
            </Field>
            <ErrorMessage error={error} />
            <button className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Connecting…' : register ? 'Create account' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : `New to ${brand.name}?`}{' '}
            <button
              onClick={() => {
                setRegister(!register);
                setError(null);
              }}
            >
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="auth-footnote">
            A focused, self-hosted workspace.
            <br />
            No external services needed to get started.
          </p>
        </div>
      </section>
    </main>
  );
}
