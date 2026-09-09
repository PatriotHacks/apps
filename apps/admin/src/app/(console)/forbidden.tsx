export default function Forbidden() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 p-6 sm:p-8">
      <h1 className="text-lg font-semibold">Admins only</h1>
      <p className="text-sm text-muted-foreground">
        Your account has the organizer role, which cannot reach this page.
      </p>
    </div>
  );
}
