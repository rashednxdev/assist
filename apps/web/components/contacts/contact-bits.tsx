'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Check,
  Copy,
  Download,
  Globe,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  Smartphone,
  Star,
  Users,
  Network,
} from 'lucide-react';
import type { ContactEmployee, ContactOffice, ContactPhone } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useContactAccess } from '@/components/contacts/contact-access';

const AVATAR_COLORS = ['bg-teal-600', 'bg-blue-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-emerald-600', 'bg-sky-600', 'bg-fuchsia-600'];

function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

export function officeTitle(o: Pick<ContactOffice, 'name' | 'short_name'>): string {
  return o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name;
}

export function mapsUrl(o: Pick<ContactOffice, 'name' | 'address' | 'thana_name' | 'district_name'>): string {
  const q = [o.name, o.address, o.thana_name, o.district_name, 'Bangladesh'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function whatsappUrl(dial: string): string | null {
  const d = dial.replace(/\D/g, '');
  if (/^01[3-9]\d{8}$/.test(d)) return `https://wa.me/880${d.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(d)) return `https://wa.me/${d}`;
  return null;
}

const iconBtn =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary';

/** Call button — opens the dialer for paid users, explains the package otherwise. */
export function DialButton({ phone, label = 'Call', compact }: { phone: ContactPhone; label?: string; compact?: boolean }) {
  const { access, requestUpgrade } = useContactAccess();
  if (access.can_dial && phone.dial) {
    return (
      <a
        href={`tel:${phone.dial}`}
        className={cn(
          'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary font-medium text-white shadow-sm transition hover:bg-primary-dark',
          compact ? 'w-8' : 'px-3 text-xs',
        )}
        title={`${label} ${phone.display}`}
      >
        <Phone className="h-3.5 w-3.5" />
        {!compact && label}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={requestUpgrade}
      aria-disabled="true"
      title="Calling is available with a package"
      className={cn(
        'inline-flex h-8 shrink-0 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-slate-50 font-medium text-muted',
        compact ? 'w-8' : 'px-3 text-xs',
      )}
    >
      <Lock className="h-3.5 w-3.5" />
      {!compact && label}
    </button>
  );
}

export function CopyButton({ text, title = 'Copy' }: { text: string; title?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={title}
      className={iconBtn}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Label + number + call / WhatsApp / copy (the extra actions only for paid users). */
export function PhoneLine({ icon: Icon = Phone, label, phone, mobile }: { icon?: typeof Phone; label: string; phone: ContactPhone; mobile?: boolean }) {
  const { access, requestUpgrade } = useContactAccess();
  const wa = mobile && access.can_dial && phone.dial ? whatsappUrl(phone.dial) : null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-muted">{label}</span>
        <span className={cn('block truncate font-medium tabular-nums', !access.can_dial && 'text-muted')}>{phone.display}</span>
      </span>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={iconBtn} title="WhatsApp">
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      )}
      {access.can_dial ? (
        <CopyButton text={phone.display} title="Copy number" />
      ) : (
        <button type="button" className={cn(iconBtn, 'cursor-not-allowed')} onClick={requestUpgrade} title="Copying numbers needs a package">
          <Lock className="h-3.5 w-3.5" />
        </button>
      )}
      <DialButton phone={phone} compact />
    </div>
  );
}

export function FavoriteStar({ type, id, value, onChange }: { type: 'office' | 'user'; id: string; value: boolean; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      title={on ? 'Remove from favourites' : 'Add to favourites'}
      aria-pressed={on}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        setOn(!on);
        try {
          const r = await apiFetch<{ data: { favorite: boolean } }>('/contacts/favorites', {
            method: 'POST',
            body: JSON.stringify({ target_type: type, target_id: id }),
          });
          setOn(r.data.favorite);
          onChange?.(r.data.favorite);
        } catch {
          setOn(on);
        } finally {
          setBusy(false);
        }
      }}
      className={cn('rounded-lg p-1.5 transition hover:bg-amber-50', on ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400')}
    >
      <Star className={cn('h-[18px] w-[18px]', on && 'fill-current')} />
    </button>
  );
}

function vcardEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function downloadVCard(input: { name: string; org?: string; title?: string; phones: Array<{ type: string; value: string }>; email?: string; url?: string; address?: string }) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardEscape(input.name)}`, `N:${vcardEscape(input.name)};;;;`];
  if (input.org) lines.push(`ORG:${vcardEscape(input.org)}`);
  if (input.title) lines.push(`TITLE:${vcardEscape(input.title)}`);
  for (const p of input.phones) lines.push(`TEL;TYPE=${p.type}:${p.value}`);
  if (input.email) lines.push(`EMAIL;TYPE=WORK:${input.email}`);
  if (input.url) lines.push(`URL:${input.url}`);
  if (input.address) lines.push(`ADR;TYPE=WORK:;;${vcardEscape(input.address)};;;;Bangladesh`);
  lines.push('END:VCARD');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${input.name.replace(/[^\w\s-]/g, '').trim() || 'contact'}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function SaveContactButton({ onSave, compact }: { onSave: () => void; compact?: boolean }) {
  const { access, requestUpgrade } = useContactAccess();
  return (
    <button
      type="button"
      onClick={access.can_dial ? onSave : requestUpgrade}
      title={access.can_dial ? 'Save to phone contacts (.vcf)' : 'Saving contacts needs a package'}
      className={cn(compact ? iconBtn : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-muted hover:text-primary', !access.can_dial && 'cursor-not-allowed')}
    >
      {access.can_dial ? <Download className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {!compact && 'Save contact'}
    </button>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-muted hover:text-primary print:hidden"
    >
      <Printer className="h-3.5 w-3.5" /> Print
    </button>
  );
}

/* ---------------------------------- offices --------------------------------- */

export function OfficeCard({ o, onFavorite }: { o: ContactOffice; onFavorite?: (v: boolean) => void }) {
  const phones = [
    o.telephone && { label: 'Telephone', phone: o.telephone, icon: Phone, mobile: false },
    o.mobile && { label: 'Mobile', phone: o.mobile, icon: Smartphone, mobile: true },
    o.pabx && { label: 'PABX', phone: o.pabx, icon: Phone, mobile: false },
  ].filter(Boolean) as Array<{ label: string; phone: ContactPhone; icon: typeof Phone; mobile: boolean }>;
  const location = [o.thana_name, o.district_name, o.division_name].filter(Boolean).join(', ');

  return (
    <article className={cn('flex flex-col rounded-2xl border bg-surface shadow-sm transition hover:shadow-md', o.is_my_office ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border')}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-sky-700 text-white shadow-sm">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {o.office_type && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{o.office_type.short_name}</span>}
            {o.office_code && <span className="rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-slate-500">{o.office_code}</span>}
            {o.is_my_office && <span className="rounded-md bg-primary px-1.5 py-0.5 font-semibold text-white">Your office</span>}
          </div>
          <Link href={`/contacts/office/${o.id}`} className="mt-1 block font-semibold leading-snug hover:text-primary-dark">
            {officeTitle(o)}
          </Link>
          {o.name_bn && <p className="text-xs text-muted">{o.name_bn}</p>}
          {o.parent_path && <p className="mt-0.5 truncate text-xs text-muted">Under {o.parent_path}</p>}
        </div>
        <FavoriteStar type="office" id={o.id} value={o.is_favorite} onChange={onFavorite} />
      </div>

      <div className="flex-1 space-y-2 px-4 pb-3">
        {phones.slice(0, 2).map((p) => (
          <PhoneLine key={p.label} label={p.label} phone={p.phone} icon={p.icon} mobile={p.mobile} />
        ))}
        {o.email && (
          <a href={`mailto:${o.email}`} className="flex items-center gap-2 truncate text-sm text-foreground hover:text-primary">
            <Mail className="h-4 w-4 shrink-0 text-muted" />
            <span className="truncate">{o.email}</span>
          </a>
        )}
        {(location || o.address) && (
          <a href={mapsUrl(o)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm text-muted hover:text-primary">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="line-clamp-2">{[o.address, location].filter(Boolean).join(', ')}</span>
          </a>
        )}
        {o.web_address && (
          <a href={o.web_address} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate text-sm text-muted hover:text-primary">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="truncate">{o.web_address.replace(/^https?:\/\//, '')}</span>
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Link
          href={`/contacts/office/${o.id}?view=sub`}
          aria-disabled={o.sub_office_count === 0}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition',
            o.sub_office_count > 0 ? 'border-border text-foreground hover:border-primary/40 hover:bg-primary-muted hover:text-primary-dark' : 'pointer-events-none border-dashed border-border text-muted-foreground',
          )}
        >
          <Network className="h-3.5 w-3.5" /> Sub-offices ({o.sub_office_count})
        </Link>
        <Link
          href={`/contacts/office/${o.id}?view=employees`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-dark"
        >
          <Users className="h-3.5 w-3.5" /> Employees ({o.employee_total})
        </Link>
      </div>
    </article>
  );
}

/* --------------------------------- employees -------------------------------- */

export function EmployeeCard({ e, showOffice = true, onFavorite }: { e: ContactEmployee; showOffice?: boolean; onFavorite?: (v: boolean) => void }) {
  const title = e.designation?.name;
  return (
    <article className={cn('flex gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition hover:shadow-md', e.is_me ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border')}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white', colorFor(e.id))} aria-hidden>
        {e.initials}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">
              {e.name}
              {e.is_me && <span className="ml-1.5 rounded bg-primary px-1.5 py-0.5 align-middle text-[10px] font-semibold text-white">You</span>}
            </p>
            {e.name_bn && e.name_bn !== e.name && <p className="text-xs text-muted">{e.name_bn}</p>}
            {e.designation && (
              <p className="mt-0.5 text-sm text-foreground">
                {e.designation.name}
                {e.designation.grade && <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600">Grade {e.designation.grade}</span>}
              </p>
            )}
            {showOffice && e.office && (
              <Link href={`/contacts/office/${e.office.id}`} className="block truncate text-xs text-muted hover:text-primary">
                {e.office.short_name || e.office.name}
                {e.office.parent_path && ` · ${e.office.parent_path}`}
              </Link>
            )}
          </div>
          <FavoriteStar type="user" id={e.id} value={e.is_favorite} onChange={onFavorite} />
        </div>
        {e.mobile ? (
          <PhoneLine label="Mobile" phone={e.mobile} icon={Smartphone} mobile />
        ) : e.phone_hidden ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" /> Mobile number kept private
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          {e.email && (
            <a href={`mailto:${e.email}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:text-primary">
              <Mail className="h-4 w-4 shrink-0 text-muted" />
              <span className="truncate">{e.email}</span>
            </a>
          )}
          {e.mobile && (
            <span className="ml-auto">
              <SaveContactButton
                compact
                onSave={() =>
                  downloadVCard({
                    name: e.name,
                    org: e.office?.name,
                    title,
                    phones: e.mobile?.dial ? [{ type: 'CELL', value: e.mobile.dial }] : [],
                    email: e.email,
                  })
                }
              />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
