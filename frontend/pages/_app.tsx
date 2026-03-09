import '../styles/globals.css'
import type { AppProps } from 'next/app'

export defaul function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
