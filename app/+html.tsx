import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every web page.
 * The <head> and <body> tags can be customized here to support Progressive Web App (PWA)
 * features, meta tags, and responsive layout styling.
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

        {/* iOS / Mobile Web App Meta */}
        <meta name="theme-color" content="#F25C05" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FOODFIX" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="FOODFIX" />

        {/* Reset ScrollView styles */}
        <ScrollViewStyleReset />

        {/* PWA & Responsive Shell Styling */}
        <style dangerouslySetInnerHTML={{ __html: responsiveStyles }} />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <div id="root-container">{children}</div>
      </body>
    </html>
  );
}

const responsiveStyles = `
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background-color: #ECE0CA;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  /* Desktop and Tablet App Framing */
  #root-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100%;
    width: 100%;
    background-color: #ECE0CA;
  }

  #root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    max-width: 480px;
    background-color: #F9F0DC;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 600px) {
    #root-container {
      background-color: #F9F0DC;
    }
    #root {
      max-width: 100%;
      height: 100%;
      box-shadow: none;
    }
  }
`;
