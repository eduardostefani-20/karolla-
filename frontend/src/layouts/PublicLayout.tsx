import { Outlet } from 'react-router-dom';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { DemoBanner } from '@/components/site/DemoBanner';

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <Header />
      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
