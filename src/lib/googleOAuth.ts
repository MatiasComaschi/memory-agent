export const initiateGmailOAuth = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/callback`;
  const scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope,
    access_type: "offline",
    prompt: "consent",
    state: "gmail_integration",
  })}`;

  // Use redirect instead of popup to avoid blocking
  window.location.href = authUrl;
};

export const initiateMicrosoft365OAuth = () => {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/callback`;
  const scope = "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read offline_access";
  
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope,
    prompt: "consent",
    state: "microsoft365_integration",
  })}`;

  window.location.href = authUrl;
};