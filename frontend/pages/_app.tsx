import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { Layout } from '../components/Layout';
import { initTelemetry } from '../services/telemetry';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    initTelemetry();
  }, []);

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
