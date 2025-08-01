export default function ThankYou() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-bold">Thanks for joining Review Remedy!</h1>
        <p>We’ve activated your account. You can start running reports now.</p>
        <a className="underline" href="/dashboard">Go to Dashboard →</a>
      </div>
    </main>
  );
}
