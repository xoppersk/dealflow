"use client";

/** Edit forms for record detail pages (R-03/R-05) — save through the
 *  updateContact / updateCompany server actions. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCompany, updateContact } from "@/lib/df/actions";
import type { Company, Contact } from "@/lib/df/types";

export function ContactEditForm({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contact.name);
  const [title, setTitle] = useState(contact.title);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [prefers, setPrefers] = useState(contact.prefers ?? "");
  const [status, setStatus] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const res = await updateContact(contact.id, {
      firstName: firstName ?? name,
      lastName: rest.join(" "),
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      prefers: prefers.trim() || null,
    });
    if (!res.ok) {
      setStatus(`Couldn’t save — ${res.error}`);
      return;
    }
    setStatus("Saved.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        Edit contact
      </button>
    );
  }
  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label className="f">
        <span>Name</span>
        <input className="in" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="f">
        <span>Title</span>
        <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="f">
        <span>Email</span>
        <input className="in" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="f">
        <span>Phone</span>
        <input className="in" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="f">
        <span>Prefers</span>
        <input className="in" value={prefers} onChange={(e) => setPrefers(e.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn pri sm">
          Save
        </button>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <span className="rec-status-line" role="status" aria-live="polite">
        {status}
      </span>
    </form>
  );
}

export function CompanyEditForm({ company }: { company: Company }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(company.name);
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [sizeLabel, setSizeLabel] = useState(company.sizeLabel ?? "");
  const [city, setCity] = useState(company.city ?? "");
  const [status, setStatus] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await updateCompany(company.id, {
      name: name.trim(),
      industry: industry.trim() || null,
      website: website.trim() || null,
      sizeLabel: sizeLabel.trim() || null,
      city: city.trim() || null,
    });
    if (!res.ok) {
      setStatus(`Couldn’t save — ${res.error}`);
      return;
    }
    setStatus("Saved.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        Edit company
      </button>
    );
  }
  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label className="f">
        <span>Name</span>
        <input className="in" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="f">
        <span>Industry</span>
        <input className="in" value={industry} onChange={(e) => setIndustry(e.target.value)} />
      </label>
      <label className="f">
        <span>Website</span>
        <input className="in" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      <label className="f">
        <span>Size</span>
        <input className="in" value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} />
      </label>
      <label className="f">
        <span>City</span>
        <input className="in" value={city} onChange={(e) => setCity(e.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn pri sm">
          Save
        </button>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <span className="rec-status-line" role="status" aria-live="polite">
        {status}
      </span>
    </form>
  );
}
