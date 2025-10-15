# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/e862ef7a-70f5-4a7e-8fe5-10f076528891

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e862ef7a-70f5-4a7e-8fe5-10f076528891) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e862ef7a-70f5-4a7e-8fe5-10f076528891) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Gmail OAuth Setup

To enable Gmail integration for sending emails, you need to configure OAuth credentials in Google Cloud Console:

### Step 1: Enable Gmail API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API" and click "Enable"

### Step 2: Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Select **External** user type (unless you have a Google Workspace)
3. Fill in the required fields:
   - App name: Your app name
   - User support email: Your email
   - Developer contact information: Your email
4. Click "Save and Continue"
5. **Add Test Users**: Click "Add Users" and add the Gmail addresses that will be used for testing (including your own)
6. Skip the "Scopes" section for now
7. Click "Save and Continue" through the remaining steps

### Step 3: Create OAuth Client ID
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Configure the following:
   - **Name**: Your app name (e.g., "EchoLead Gmail Integration")
   - **Authorized JavaScript origins**: Add your Lovable domain
     - `https://your-project-id.lovable.app`
     - `https://lovable.dev` (if using preview)
   - **Authorized redirect URIs**: Add the exact edge function URL
     - `https://izazjxvjxgtduiyojxbu.supabase.co/functions/v1/handle-gmail-oauth`
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

### Step 4: Configure Secrets in Lovable Cloud
1. In your Lovable project, the following secrets are already configured:
   - `ClientID` - Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
2. If you need to update them, ask the Lovable AI to help you update these secrets

### Step 5: Add Environment Variable to Frontend
1. The `VITE_GOOGLE_CLIENT_ID` should be set in your frontend `.env` file (this is a publishable key, so it's safe to commit)
2. This should match the `ClientID` secret value

### Important Notes
- While your app is in "Testing" mode, only test users you've explicitly added can authenticate
- The Gmail API has daily quotas - see [Gmail API Usage Limits](https://developers.google.com/gmail/api/reference/quota)
- For production, you'll need to verify your app with Google (submit for verification in the OAuth consent screen)
- The redirect URI must exactly match what's configured in Google Cloud Console

### Testing the Integration
1. Go to Settings > Integrations in your app
2. Click "Connect" on the Gmail integration
3. You'll be redirected to Google to authorize access
4. After authorization, you'll be redirected back to your app
5. The integration should show as "Connected" with a green badge
