/** Neutral inactive notice — no app name, features, or org details. */
export function SiteInactiveNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-6">
      <div className="max-w-sm text-center">
        <p className="text-lg font-medium text-neutral-800">This site is currently inactive.</p>
        <p className="mt-2 text-sm text-neutral-500">Please try again later.</p>
      </div>
    </div>
  );
}
