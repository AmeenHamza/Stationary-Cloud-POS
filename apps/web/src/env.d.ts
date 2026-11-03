// Public variables Next inlines at build time (DEPLOYMENT.md §4.2). Declared here so `src/lib/env.ts`
// can read them with dot access, which is what Next's inlining requires.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_API_URL?: string;
  }
}
