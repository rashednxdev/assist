/** No app shell. This route only redirects, so it does not mount nav or wait on extra queries. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
