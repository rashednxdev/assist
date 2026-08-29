import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy route — live class is under /live/[id]. */
export default function ZoomDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(app)/live/${id}` as never} />;
}
