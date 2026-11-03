import Link from 'next/link';

import { BrandMark } from '@/components/layout/BrandMark';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoginForm } from '@/features/auth';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-[radial-gradient(ellipse_at_center,var(--color-accent),var(--color-background)_70%)] p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md gap-8 py-10">
        <CardHeader className="justify-items-center gap-3 text-center">
          <BrandMark size="lg" className="justify-items-center" />
          <p className="text-muted-foreground">Sign in to start billing</p>
        </CardHeader>
        <CardContent className="grid gap-5 px-8">
          <LoginForm />
          <p className="text-center text-sm text-muted-foreground">
            Need an account?{' '}
            <Link href="/signup" className="text-primary underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
