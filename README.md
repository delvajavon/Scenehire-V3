# Scene Organizer Pro

Build a modern web application called SceneHire.

SceneHire is an operating system for temporary production teams (film, commercials, music videos, photoshoots, live events).

This MVP is NOT a marketplace.

Production companies already know who they want to hire.

The purpose of SceneHire is to organize everything AFTER the team has already been selected.

Design Requirements

• Clean modern interface

• Black and white theme

• Minimal

• Apple / Linear inspired

• Responsive

• Fast

The application has three user types:

1. Producer

2. Crew Member

3. Actor

For this MVP only build the Producer dashboard.

After logging in the Producer sees:

Projects

A list of productions.

Example:

Nike Commercial

Music Video

Short Film

A button:

+ New Production

When creating a production ask for:

Production Name

Start Date

End Date

Location

Production Type

After creating a production open a dashboard with four tabs.

Crew

Contracts

Schedule

Files

Crew Tab

Producer can add people manually.

Fields:

Name

Role

Email

Status

Status should show:

Invited

Signed

Contracts Tab

Producer can upload PDF contracts.

Display uploaded contracts in a clean list.

Schedule Tab

Simple calendar view.

Allow producer to add schedule events.

Files Tab

Allow uploads.

Show uploaded files in a list.

Navigation

Sidebar:

Projects

Settings

Profile

Do not build payments.

Do not build messaging.

Do not build AI.

Do not build notifications.

Focus entirely on creating an elegant MVP with realistic sample production data.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/70e73391-060a-47c0-a8ed-aba492e09f78).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Authentication setup (Clerk)

SceneHire uses Clerk for sign-in and session handling. Create a local `.env` file from `.env.example` and set:

```sh
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_OWNER_EMAIL=you@yourdomain.com

# Optional: needed only for Settings > Email inbox connection
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8080/email-callback
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

### Clerk dashboard setup

1. Create a Clerk application.
2. Enable Google as a social connection in Clerk.
3. Set allowed redirect URLs to include `http://localhost:8080/login` and your production domain login URL.
4. Copy the Publishable Key from Clerk and set `VITE_CLERK_PUBLISHABLE_KEY` in `.env`.

Google Cloud Console setup (only for inbox integration in Settings):

1. Create an OAuth 2.0 Web application credential.
2. Add `http://localhost:8080/email-callback` to Authorized redirect URIs.
3. Add `http://localhost:8080` to Authorized JavaScript origins.
4. Enable the Google APIs used by the app if your project restricts them.

After updating `.env`, restart `npm run dev` so the new variables are loaded.

## Keep dashboard private (owner-only)

To keep the public landing page open while making the dashboard private to only you:

1. Set `VITE_OWNER_EMAIL` in `.env` to your exact Google login email.
2. Keep Clerk configured (`VITE_CLERK_PUBLISHABLE_KEY`).
3. Sign in with Clerk using your owner email.

With this setup, `/projects`, `/projects/:id`, `/inbox`, `/settings`, and `/profile` are restricted to the owner email and redirect unauthorized users to `/login`.
