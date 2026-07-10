import { getRequestConfig } from 'next-intl/server';
import { defaultLocale } from './config';

/** App UI stays English. Pension/Joining use a local locale provider. */
export default getRequestConfig(async () => {
  return {
    locale: defaultLocale,
    messages: (await import(`../messages/${defaultLocale}.json`)).default,
  };
});
