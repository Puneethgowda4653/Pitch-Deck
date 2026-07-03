export default function BillingPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Billing</h1>
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-semibold text-text-primary mb-2">Current Plan</h2>
        <p className="text-text-secondary text-sm">You are on the <span className="text-violet font-medium">Free</span> plan.</p>
        <button className="mt-4 bg-brand-gradient text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
