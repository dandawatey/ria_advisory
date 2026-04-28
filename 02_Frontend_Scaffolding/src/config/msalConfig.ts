import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

const msalConfiguration: Configuration = {
  auth: {
    clientId:    import.meta.env.VITE_AZURE_CLIENT_ID ?? '00000000-0000-0000-0000-000000000000',
    authority:   `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID ?? 'common'}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI ?? window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii) return;
        if (import.meta.env.DEV) console.log(`[MSAL] ${message}`);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfiguration);

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};
