import { RoleRedirect, ViewerGate } from '@/features/auth';

/** `/` sends signed-in users to their role's home and everyone else to /login. */
export default function HomePage() {
  return (
    <ViewerGate>
      <RoleRedirect />
    </ViewerGate>
  );
}
