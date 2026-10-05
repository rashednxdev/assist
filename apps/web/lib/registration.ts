/** Web sign-up is open unless NEXT_PUBLIC_WEB_REGISTRATION_CLOSED=true at build time; the mobile app is unaffected. */
export const WEB_REGISTRATION_OPEN = process.env.NEXT_PUBLIC_WEB_REGISTRATION_CLOSED !== 'true';
