import '@tabler/core/dist/css/tabler.min.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="antialiased">
      {children}
    </div>
  );
}
