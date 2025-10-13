export const initiateGmailOAuth = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/callback`;
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"
  );
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope,
    access_type: "offline",
    prompt: "consent",
    state: "gmail_integration",
  })}`;

  // Open OAuth window
  const width = 500;
  const height = 600;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  
  window.open(
    authUrl,
    "Gmail OAuth",
    `width=${width},height=${height},left=${left},top=${top}`
  );
};