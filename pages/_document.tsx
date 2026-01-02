import {Html, Head, Main, NextScript} from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
        <Head>
            {/* PWA manifest */}
            <link rel="manifest" href="/manifest.json" />

            {/* Theme colors */}
            <meta name="theme-color" content="#0b74de" />
            <meta 
                name="apple-mobile-web-app-status-bar-style"
                content="black-translucent" 
            />

            {/* PWA Capabilities */}
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-title" content="Everyday" />

            {/* Icons */}            
            <link rel="icon" href="/icons/icon-192.png" />
            <link rel="apple-touch-icon" href="/icons/icon-192.png" />            
            <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
            <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />

            {/* Description */}
            <meta name="description" content="Your everyday companion for workouts, tasks, and calendar events, and more." />
        </Head>
        <body>
            <Main />
            <NextScript />
        </body>
    </Html>
  );
}         
    