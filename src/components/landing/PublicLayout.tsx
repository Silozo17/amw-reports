import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => (
  <div className="min-h-screen flex flex-col bg-amw-black text-amw-offwhite dark">
    <PublicNavbar />
    <main className="flex-1">{children}</main>
    <PublicFooter />
  </div>
);

export default PublicLayout;
