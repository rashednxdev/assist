import { Redirect } from 'expo-router';

/** Legacy route — live class is under /live. */
export default function ZoomListRedirect() {
  return <Redirect href="/(app)/live" />;
}
