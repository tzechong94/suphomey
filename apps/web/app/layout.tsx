import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['600', '700', '800'] });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: { default: 'suphomey: kaypoh every HDB block', template: '%s · suphomey' },
  description:
    'Find an HDB flat to rent or buy. Real rents and resale prices, MRT, hawkers, schools and what is planned next door, for every block in Singapore. Built on data.gov.sg.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-SG" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="border-t-2 border-ink/10 px-4 py-6 text-center text-xs text-ink-3">
            Data from <a className="underline" href="https://data.gov.sg">data.gov.sg</a> (Singapore Open Data Licence). Distances are straight-line.
            Not financial advice, just very nosy.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
