# Session Timeout Feature

## Overview
Professional session management with automatic logout after inactivity, just like enterprise applications.

## Features

### 1. **Idle Timeout**
- Users are automatically logged out after 30 minutes of inactivity (configurable)
- Activity is tracked through mouse movements, clicks, keyboard input, scrolling, and touch events
- Activity tracking is throttled to once per second for performance

### 2. **Warning Dialog**
- Users see a warning dialog 2 minutes before automatic logout (configurable)
- Shows a countdown timer with remaining time
- Users can click "Stay Logged In" to reset the timer
- Any user activity (mouse move, click, etc.) also resets the timer

### 3. **Token Expiration**
- JWT tokens expire after 24 hours
- Tokens are automatically refreshed every hour during active sessions
- Expired tokens trigger immediate logout

### 4. **Session Expiry Message**
- When redirected to login after session timeout, users see a clear message
- Message: "Your session has expired due to inactivity. Please sign in again."

## Configuration

### Environment Variables (.env)

```env
# Session Timeout Configuration
NEXT_PUBLIC_IDLE_TIMEOUT=1800000    # 30 minutes in milliseconds
NEXT_PUBLIC_WARNING_TIME=120000     # 2 minutes in milliseconds

# Token Expiry
ACCESS_TOKEN_EXPIRY=1d              # 24 hours
REFRESH_TOKEN_EXPIRY=7d             # 7 days
```

### Customization

To change timeout values:

1. **Idle Timeout**: Modify `NEXT_PUBLIC_IDLE_TIMEOUT` in `.env`
   - Default: 1800000 (30 minutes)
   - Example: 900000 (15 minutes), 3600000 (1 hour)

2. **Warning Time**: Modify `NEXT_PUBLIC_WARNING_TIME` in `.env`
   - Default: 120000 (2 minutes)
   - Example: 60000 (1 minute), 300000 (5 minutes)

## How It Works

### 1. Session Provider
The `SessionProvider` wraps your app and includes the `SessionTimeoutWarning` component:

```tsx
// src/app/layout.tsx
<SessionProvider>
  <ToastProvider>
    {children}
  </ToastProvider>
</SessionProvider>
```

### 2. Session Timeout Hook
The `useSessionTimeout` hook tracks user activity and manages timers:

```tsx
// Automatically used by SessionTimeoutWarning
const { resetTimer } = useSessionTimeout({
  idleTimeout: 30 * 60 * 1000,  // 30 minutes
  warningTime: 2 * 60 * 1000,   // 2 minutes
  onWarning: () => {
    // Show warning dialog
  },
  onLogout: () => {
    // Logout user
  },
});
```

### 3. Activity Tracking
The following events reset the idle timer:
- `mousedown` - Mouse button press
- `mousemove` - Mouse movement
- `keypress` - Keyboard input
- `scroll` - Page scrolling
- `touchstart` - Touch screen interaction
- `click` - Click events

### 4. Token Management
- NextAuth session maxAge: 24 hours
- Session updates every 1 hour
- JWT tokens include issued-at timestamp
- Tokens are checked every minute for expiration

## User Experience

### Normal Flow
1. User logs in
2. User interacts with the app
3. Idle timer resets on each interaction
4. Session remains active

### Idle Flow
1. User stops interacting with the app
2. After 28 minutes (30 - 2), warning dialog appears
3. User sees countdown: "2:00" → "1:59" → ... → "0:01"
4. User can click "Stay Logged In" or move mouse to reset timer
5. If no action, user is logged out at 0:00
6. User is redirected to login with "Session Expired" message

### Token Expiry Flow
1. User's token expires (after 24 hours)
2. Token expiry is detected
3. User is immediately logged out
4. User is redirected to login with "Session Expired" message

## Security Benefits

1. **Prevents Unauthorized Access**: Automatically logs out inactive users
2. **Protects Shared Computers**: Users can't leave sessions open indefinitely
3. **Compliance**: Meets security requirements for educational institutions
4. **Token Rotation**: Regular token refresh reduces security risks

## Testing

### Test Idle Timeout
1. Log in to the application
2. Don't interact with the page for 28 minutes
3. Warning dialog should appear
4. Wait 2 more minutes without interaction
5. You should be logged out and redirected to login

### Test Activity Reset
1. Log in to the application
2. Wait for warning dialog to appear
3. Move your mouse or click anywhere
4. Warning dialog should disappear
5. Timer should reset

### Test Token Expiry
1. Log in to the application
2. Manually set your system time forward by 25 hours
3. Wait 1 minute
4. You should be logged out automatically

## Troubleshooting

### Warning Dialog Not Appearing
- Check browser console for errors
- Verify `NEXT_PUBLIC_IDLE_TIMEOUT` and `NEXT_PUBLIC_WARNING_TIME` are set
- Ensure you're authenticated (check session status)

### Logged Out Too Quickly
- Check `NEXT_PUBLIC_IDLE_TIMEOUT` value in `.env`
- Verify activity tracking is working (check console logs)
- Ensure throttling isn't too aggressive

### Warning Dialog Won't Dismiss
- Try clicking "Stay Logged In" button
- Move your mouse or press a key
- Check for JavaScript errors in console

## Files Modified/Created

### New Files
- `src/hooks/useSessionTimeout.ts` - Session timeout logic
- `src/components/organisms/SessionTimeoutWarning.tsx` - Warning dialog UI
- `src/providers/SessionProvider.tsx` - Session provider wrapper

### Modified Files
- `auth.ts` - Added session maxAge and token refresh
- `src/app/layout.tsx` - Updated to use custom SessionProvider
- `src/app/auth/login/page.tsx` - Added session expiry message
- `.env` - Added timeout configuration
- `src/hooks/index.ts` - Exported new hook

## Best Practices

1. **Don't Set Timeout Too Short**: Users need reasonable time to work
2. **Provide Clear Warnings**: Give users time to save work
3. **Track Meaningful Activity**: Mouse movement is a good indicator
4. **Test Thoroughly**: Test on different devices and browsers
5. **Document for Users**: Let users know about the timeout policy
