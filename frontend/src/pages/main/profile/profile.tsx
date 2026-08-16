import { Skeleton } from "@mantine/core";
import { CalendarDays, Mail, ShieldCheck, UserRound } from "lucide-react";
import { USER_API_HOOKS } from "@/hooks";
import { PageHeader } from "@/components/common";

const Profile = () => {
  const { data: user, isLoading, isError } = USER_API_HOOKS.useGetUser();

  if (isLoading) {
    return <div className="space-y-5"><Skeleton height={82} radius="lg" /><Skeleton height={260} radius="lg" /></div>;
  }

  if (isError || !user) {
    return <div className="empty-state m-0"><UserRound size={34} className="text-brand" /><h2 className="mt-3 text-section-title-scale">Account details unavailable</h2><p className="mt-2 text-supporting-scale">Refresh the page to try loading your account again.</p></div>;
  }

  const joinedOn = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(user.createdAt));
  const details = [
    { label: "Full name", value: `${user.fname} ${user.lname}`, icon: UserRound },
    { label: "Email address", value: user.email, icon: Mail },
    { label: "Member since", value: joinedOn, icon: CalendarDays },
    { label: "Account status", value: user.isActive ? "Active" : "Inactive", icon: ShieldCheck },
  ];

  return (
    <section aria-labelledby="profile-title">
      <PageHeader eyebrow="Account" title="Account overview" description="The personal details connected to your orders and delivery history." />
      <div className="rounded-card border border-border bg-surface shadow-subtle">
        <div className="border-b border-border px-5 py-4 sm:px-6"><h2 id="profile-title" className="text-card-title-scale">Personal information</h2><p className="mt-1 text-sm text-ink-muted">These details identify your PizzaStore account.</p></div>
        <dl className="grid grid-cols-1 sm:grid-cols-2">
          {details.map(({ label, value, icon: Icon }, index) => (
            <div key={label} className={`flex gap-3 px-5 py-5 sm:px-6 ${index < 2 ? "border-b border-border" : ""} ${index % 2 === 0 ? "sm:border-r sm:border-border" : ""}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-muted text-brand"><Icon size={19} aria-hidden="true" /></span>
              <div className="min-w-0"><dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</dt><dd className="mt-1 break-words font-semibold text-ink">{value}</dd></div>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-card border border-basil/20 bg-basil-soft p-4 text-sm text-basil">
        <ShieldCheck className="mt-0.5 shrink-0" size={19} aria-hidden="true" /><p><span className="font-semibold">Your account is protected.</span> Profile editing is not currently supported by the account API, so no inactive edit control is shown.</p>
      </div>
    </section>
  );
};

export default Profile;
