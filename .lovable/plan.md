

## Plan: Add Test User Account

### What
Create a test user account (test@test.com / T5sT!) in the authentication system, with a profile automatically created via the existing `handle_new_user` trigger.

### How
1. **Enable auto-confirm for email signups** temporarily using the auth configuration tool, so the test user can sign in immediately without email verification
2. **Create the user** by calling the signup endpoint or using a database insert via an edge function
3. **Disable auto-confirm** after the user is created (to restore the requirement for real users)

Alternatively (simpler approach):
1. Use the signup form on the app itself — but this requires email confirmation unless we temporarily enable auto-confirm

### Recommended Approach
- Temporarily enable auto-confirm email signups
- Sign up the test user via the app's auth API
- Disable auto-confirm afterward

The `handle_new_user` trigger will automatically create a profile row. Since there's already an owner role assigned (info@amwmedia.co.uk), this test user will get no role by default.

### Technical Details
- Tool: `configure_auth` to toggle email auto-confirm
- The user will exist in `auth.users`, with a corresponding `profiles` row
- No role will be assigned (the trigger only assigns `owner` to the first-ever user)

