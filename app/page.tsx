import Gate from '@/components/Gate';

// HomePage: main gate, but also supports ?token=xxx or ?q=xxx for direct open without entering ID on main site
// The actual auto-redirect logic lives in Gate.tsx (client side), but we keep this as server component wrapper
// Direct links /q/[token] bypass this entirely and open questionnaire instantly
export default function HomePage() {
  return <Gate />;
}
