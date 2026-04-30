import { useEffect, useMemo, useState } from "react";

type Category =
  | "Support"
  | "CRM & Sales"
  | "Product analytics"
  | "Email & messaging"
  | "Commerce & billing"
  | "Identity & risk"
  | "Internal";

interface Integration {
  id: string;
  name: string;
  category: Category;
  blurb: string;
  signals: string[];
  mark: string;
  accent: string;
  popular?: boolean;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "zendesk",
    name: "Zendesk",
    category: "Support",
    blurb:
      "Pull ticket history, CSAT, and the last conversation with the cardholder.",
    signals: ["Ticket transcripts", "Macros & resolutions", "CSAT scores"],
    mark: "Z",
    accent: "#03363D",
    popular: true,
  },
  {
    id: "intercom",
    name: "Intercom",
    category: "Support",
    blurb:
      "Surface chat threads, Fin AI handoffs, and customer mood prior to the chargeback.",
    signals: ["Live chat history", "Help Center reads", "User segments"],
    mark: "i",
    accent: "#1F8DED",
    popular: true,
  },
  {
    id: "helpscout",
    name: "Help Scout",
    category: "Support",
    blurb: "Email-style support threads and saved replies.",
    signals: ["Email threads", "Tags", "Resolved-by"],
    mark: "H",
    accent: "#1292EE",
  },
  {
    id: "front",
    name: "Front",
    category: "Support",
    blurb: "Shared inbox conversations across email, SMS, and social.",
    signals: ["Cross-channel threads", "Assigned teammates"],
    mark: "F",
    accent: "#A857F1",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM & Sales",
    blurb:
      "Lifecycle stage, deal notes, and account-level relationship history.",
    signals: ["Lifecycle stage", "Deal notes", "Owner activity"],
    mark: "H",
    accent: "#FF7A59",
    popular: true,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM & Sales",
    blurb: "Account, opportunity, and case data for B2B disputes.",
    signals: ["Account hierarchy", "Cases", "Opportunities"],
    mark: "S",
    accent: "#00A1E0",
  },
  {
    id: "attio",
    name: "Attio",
    category: "CRM & Sales",
    blurb: "Modern CRM records — workspace activity, contacts, and notes.",
    signals: ["Workspace records", "Activity log"],
    mark: "A",
    accent: "#1F2937",
  },
  {
    id: "mixpanel",
    name: "Mixpanel",
    category: "Product analytics",
    blurb:
      "Product events showing the user actually used what they're disputing.",
    signals: ["Session events", "Feature engagement", "Last-active"],
    mark: "M",
    accent: "#7856FF",
    popular: true,
  },
  {
    id: "amplitude",
    name: "Amplitude",
    category: "Product analytics",
    blurb: "Behavioral analytics: cohorts, funnels, and retention.",
    signals: ["User journey", "Feature usage", "Cohorts"],
    mark: "A",
    accent: "#1F6FEB",
  },
  {
    id: "posthog",
    name: "PostHog",
    category: "Product analytics",
    blurb: "Open-source product analytics, session replays, and feature flags.",
    signals: ["Session replays", "Events", "Flag exposures"],
    mark: "P",
    accent: "#F54E00",
  },
  {
    id: "segment",
    name: "Segment",
    category: "Product analytics",
    blurb: "Unified customer data pipeline. One hookup, many sources.",
    signals: ["Identify calls", "Track events"],
    mark: "S",
    accent: "#52BD94",
  },
  {
    id: "postmark",
    name: "Postmark",
    category: "Email & messaging",
    blurb: "Transactional email logs — receipts, shipping confirms, and opens.",
    signals: ["Delivered emails", "Open & click", "Bounce status"],
    mark: "P",
    accent: "#FFDE00",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "Email & messaging",
    blurb: "Email events at scale — verify the receipt was actually opened.",
    signals: ["Delivery", "Opens", "Suppressions"],
    mark: "S",
    accent: "#1A82E2",
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Email & messaging",
    blurb: "SMS and voice records — proof of OTPs, alerts, and outreach.",
    signals: ["SMS receipts", "Verify codes", "Call logs"],
    mark: "T",
    accent: "#F22F46",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Internal",
    blurb:
      "Internal threads about this customer (CX, on-call, refund decisions).",
    signals: ["Thread mentions", "Decision logs"],
    mark: "#",
    accent: "#4A154B",
    popular: true,
  },
  {
    id: "linear",
    name: "Linear",
    category: "Internal",
    blurb: "Bug reports & incidents tied to the disputed time window.",
    signals: ["Issues by date", "Incidents"],
    mark: "L",
    accent: "#5E6AD2",
  },
  {
    id: "notion",
    name: "Notion",
    category: "Internal",
    blurb: "Internal policies, refund SOPs, and merchant-side terms snapshots.",
    signals: ["Policy docs", "Refund SOPs"],
    mark: "N",
    accent: "#FFFFFF",
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "Commerce & billing",
    blurb:
      "Order, fulfillment, and shipping data straight from the storefront.",
    signals: ["Orders & line items", "Fulfillments", "Tracking numbers"],
    mark: "S",
    accent: "#7AB55C",
  },
  {
    id: "shippo",
    name: "Shippo",
    category: "Commerce & billing",
    blurb: "Carrier-level tracking + signed delivery receipts across carriers.",
    signals: ["Tracking events", "POD signatures"],
    mark: "S",
    accent: "#7B68EE",
  },
  {
    id: "chargebee",
    name: "Chargebee",
    category: "Commerce & billing",
    blurb: "Subscription state, invoices, and renewal notices.",
    signals: ["Plan changes", "Dunning emails", "Invoice history"],
    mark: "C",
    accent: "#FF7846",
  },
  {
    id: "sift",
    name: "Sift",
    category: "Identity & risk",
    blurb: "Fraud and trust signals — device, velocity, and known-bad patterns.",
    signals: ["Risk score", "Device fingerprint", "Velocity flags"],
    mark: "S",
    accent: "#F26100",
  },
  {
    id: "persona",
    name: "Persona",
    category: "Identity & risk",
    blurb: "KYC / identity verification artifacts for high-value disputes.",
    signals: ["ID verification", "Selfie match"],
    mark: "P",
    accent: "#1F2937",
  },
];

const CATEGORIES: Category[] = [
  "Support",
  "CRM & Sales",
  "Product analytics",
  "Email & messaging",
  "Commerce & billing",
  "Identity & risk",
  "Internal",
];

const STORAGE_KEY = "chargebucks.integrations.connected.v1";

function loadConnected(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveConnected(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function Integrations() {
  const [connected, setConnected] = useState<Set<string>>(() => loadConnected());
  const [filter, setFilter] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    saveConnected(connected);
  }, [connected]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter((i) => {
      if (filter !== "all" && i.category !== filter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.blurb.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    });
  }, [filter, query]);

  const toggle = (id: string) => {
    setConnected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const connectedCount = connected.size;
  const totalCount = INTEGRATIONS.length;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <div className="eyebrow-row">
            <div className="eyebrow">
              <span className="dashboard-eyebrow-divider" />
              Integrations
            </div>
          </div>
          <h1>Connect your stack</h1>
          <p className="dashboard-sub">
            The agent gets sharper with every source you wire up. Plug in
            support, CRM, analytics, and commerce tools — Chargebucks pulls
            evidence from each one to strengthen your representment.
          </p>
        </div>
        <div className="dashboard-actions">
          <div className="integrations-count">
            <span className="ic-num">{connectedCount}</span>
            <span className="ic-sep">/</span>
            <span className="ic-total">{totalCount}</span>
            <span className="ic-label">connected</span>
          </div>
        </div>
      </header>

      <div className="integrations-banner">
        <div className="ib-icon">★</div>
        <div className="ib-body">
          <strong>Demo only.</strong>
          <span className="muted">
            {" "}
            Toggling these doesn't actually call any third-party API. It just
            previews how the agent's evidence sources would expand.
          </span>
        </div>
      </div>

      <div className="dashboard-toolbar">
        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All · {totalCount}
          </button>
          {CATEGORIES.map((c) => {
            const n = INTEGRATIONS.filter((i) => i.category === c).length;
            return (
              <button
                key={c}
                type="button"
                className={`chip ${filter === c ? "active" : ""}`}
                onClick={() => setFilter(c)}
              >
                {c} · {n}
              </button>
            );
          })}
        </div>
        <input
          className="integration-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations…"
        />
      </div>

      <div className="integration-grid">
        {visible.map((i) => (
          <IntegrationCard
            key={i.id}
            integration={i}
            connected={connected.has(i.id)}
            onToggle={() => toggle(i.id)}
          />
        ))}
        <RequestCard />
      </div>
    </div>
  );
}

function IntegrationCard({
  integration,
  connected,
  onToggle,
}: {
  integration: Integration;
  connected: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`integration-card ${connected ? "connected" : ""}`}>
      <header className="integration-card-head">
        <div
          className="integration-mark"
          style={{
            background: integration.accent,
            color: integration.accent === "#FFFFFF" ? "#111" : "#fff",
          }}
          aria-hidden
        >
          {integration.mark}
        </div>
        <div className="integration-title">
          <div className="integration-name">
            {integration.name}
            {integration.popular && <span className="pop-pill">Popular</span>}
          </div>
          <div className="integration-cat">{integration.category}</div>
        </div>
        {connected && (
          <span className="connected-pip" title="Connected">
            <span className="pip-dot" />
            Connected
          </span>
        )}
      </header>
      <p className="integration-blurb">{integration.blurb}</p>
      <ul className="integration-signals">
        {integration.signals.map((s) => (
          <li key={s}>
            <span className="signal-bullet" />
            {s}
          </li>
        ))}
      </ul>
      <footer className="integration-foot">
        <button
          type="button"
          className={`btn ${connected ? "btn-ghost" : "btn-primary"}`}
          onClick={onToggle}
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
        <button type="button" className="btn btn-link" disabled>
          Configure →
        </button>
      </footer>
    </article>
  );
}

function RequestCard() {
  return (
    <article className="integration-card request-card">
      <div className="request-glow" />
      <header className="integration-card-head">
        <div className="integration-mark request-mark" aria-hidden>
          +
        </div>
        <div className="integration-title">
          <div className="integration-name">Don't see your tool?</div>
          <div className="integration-cat">Request an integration</div>
        </div>
      </header>
      <p className="integration-blurb">
        We add new evidence sources every couple of weeks. Tell us what
        you're missing and we'll prioritize.
      </p>
      <footer className="integration-foot">
        <button type="button" className="btn btn-ghost" disabled>
          Request integration
        </button>
      </footer>
    </article>
  );
}
