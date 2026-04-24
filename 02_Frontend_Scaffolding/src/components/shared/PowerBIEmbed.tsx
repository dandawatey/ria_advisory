/**
 * PowerBIEmbed — wraps @microsoft/powerbi-client-react
 * In production, embedUrl + accessToken are fetched from the API layer (F019)
 * which calls the Power BI REST API with a service-principal token.
 * For the scaffold, a placeholder is shown when no config is provided.
 */
import React from 'react';
// NOTE: Uncomment when ready to wire up real Power BI tokens:
// import { PowerBIEmbed as PBIEmbed } from 'powerbi-client-react';
// import { models } from 'powerbi-client';
import type { PowerBIConfig } from '../../types';

interface PowerBIEmbedProps {
  config?: PowerBIConfig;
  height?: number;
  title?: string;
}

export const PowerBIEmbed: React.FC<PowerBIEmbedProps> = ({
  config,
  height = 500,
  title = 'Power BI Report',
}) => {
  // Production implementation (uncomment when ready):
  // if (config) {
  //   return (
  //     <PBIEmbed
  //       embedConfig={{
  //         type: 'report',
  //         id: config.reportId,
  //         embedUrl: config.embedUrl,
  //         accessToken: config.accessToken,
  //         tokenType: models.TokenType.Embed,
  //         settings: {
  //           filterPaneEnabled: false,
  //           navContentPaneEnabled: true,
  //         },
  //       }}
  //       cssClassName="powerbi-embed"
  //       getEmbeddedComponent={(embeddedReport) => {
  //         console.debug('PowerBI report embedded', embeddedReport);
  //       }}
  //     />
  //   );
  // }

  // Scaffold placeholder
  return (
    <div className="powerbi-placeholder" style={{ height }}>
      <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="4" fill="rgba(255,255,255,0.15)" />
        <path d="M8 24V8h4v16H8zm6-6V8h4v10h-4zm6-4V8h4v6h-4z" fill="white" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          Power BI Embedded Report
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8, maxWidth: 280 }}>
          Connect via API layer (F019) → Power BI Embed token endpoint
          {config && <span> · Report ID: {config.reportId.slice(0, 8)}…</span>}
        </div>
      </div>
    </div>
  );
};
