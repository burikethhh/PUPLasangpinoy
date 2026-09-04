import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML template for Expo Router Web & PWA.
 * Renders `{children}` directly inside `<body>` to prevent React hydration mismatch (#418).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover" />
        <title>FOODFIX - Derick&apos;s Food House</title>
        <meta name="description" content="FOODFIX - Derick's Food House Filipino Food Ordering System & Culinary AI Assistant" />

        {/* PWA Manifest & Icons */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/pwa-icon-192.png" />

        {/* Mobile Web App Meta */}
        <meta name="theme-color" content="#F25C05" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FOODFIX" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="FOODFIX" />

        {/* Reset ScrollView styles */}
        <ScrollViewStyleReset />

        {/* Ionicons Fallback @font-face & PWA Styling */}
        <style dangerouslySetInnerHTML={{ __html: responsiveStyles }} />

        {/* Service Worker Auto-Update & Cache Recovery */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    reg.update();
                  }).catch(function(err) {
                    console.log('SW registration note:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveStyles = `
  @font-face {
    font-family: 'Ionicons';
    src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf') format('truetype'),
         url('https://unpkg.com/ionicons@4.5.10-0/dist/fonts/ionicons.ttf') format('truetype');
    font-display: swap;
  }

  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background-color: #ECE0CA;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  /* Desktop and Tablet App Framing directly on #root — no wrapper div */
  #root {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 480px;
    margin: 0 auto;
    background-color: #F9F0DC;
    box-shadow: 0 0 24px rgba(0, 0, 0, 0.12);
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 600px) {
    #root {
      max-width: 100%;
      box-shadow: none;
    }
  }
`;
