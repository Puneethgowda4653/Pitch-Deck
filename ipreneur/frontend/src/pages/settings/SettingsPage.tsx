import { useCurrentUser } from "@/stores/authStore";

export default function SettingsPage() {
  const user = useCurrentUser();
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-semibold text-text-primary mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-text-secondary">Name</span><span className="text-text-primary">{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">Email</span><span className="text-text-primary">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">Plan</span><span className="text-text-primary capitalize">{user?.role}</span></div>
        </div>
      </div>
    </div>
  );
}
