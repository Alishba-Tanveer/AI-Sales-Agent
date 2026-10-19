export default function Page() {
  return (
    <main className="min-h-[calc(100vh-4rem)] p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">
          Everything the AI agent has done: research, drafts, sends and failures.
        </p>
      </div>
    </main>
  );
}
