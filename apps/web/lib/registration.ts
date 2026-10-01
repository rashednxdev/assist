/** Web sign-up is closed unless NEXT_PUBLIC_WEB_REGISTRATION_OPEN=true at build time; the mobile app is unaffected. */
export const WEB_REGISTRATION_OPEN = process.env.NEXT_PUBLIC_WEB_REGISTRATION_OPEN === 'true';
