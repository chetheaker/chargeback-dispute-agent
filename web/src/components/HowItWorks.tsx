import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cb_how_it_works_seen";

export function HowItWorks() {
  const [open, setOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY) === "1";
    setHasSeen(seen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!hasSeen) {
      localStorage.setItem(STORAGE_KEY, "1");
      setHasSeen(true);
    }
  };

  return (
    <div className="how-it-works" ref={ref}>
      <button
        type="button"
        className={`hiw-trigger ${!hasSeen ? "hiw-pulse" : ""}`}
        onClick={handleOpen}
        aria-expanded={open}
        title="How Chargebucks works"
      >
        <span className="hiw-icon">i</span>
        <span>How it works</span>
        {!hasSeen && <span className="hiw-dot" />}
      </button>

      {open && (
        <div className="hiw-popover" role="dialog">
          <div className="hiw-head">
            <strong>What is Chargebucks?</strong>
            <button
              type="button"
              className="hiw-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="hiw-lede">
            Chargebucks is a chargeback-dispute autopilot for indie devs on
            Stripe. When a customer disputes a charge, the agent investigates,
            drafts a defensible response, and submits the evidence to Stripe —
            so you don't lose your weekend to fighting fraud.
          </p>

          <ol className="hiw-steps">
            <li>
              <span className="hiw-step-num">1</span>
              <div>
                <strong>Stripe webhook fires</strong>
                <span className="muted">
                  A new chargeback hits <code>charge.dispute.created</code>.
                </span>
              </div>
            </li>
            <li>
              <span className="hiw-step-num">2</span>
              <div>
                <strong>Agent investigates</strong>
                <span className="muted">
                  Pulls order history, comms, device fingerprint, delivery
                  proof, and your terms — only what's relevant to the reason
                  code.
                </span>
              </div>
            </li>
            <li>
              <span className="hiw-step-num">3</span>
              <div>
                <strong>Draft + cite</strong>
                <span className="muted">
                  Writes a representment narrative with inline citations to
                  every piece of evidence.
                </span>
              </div>
            </li>
            <li>
              <span className="hiw-step-num">4</span>
              <div>
                <strong>You decide</strong>
                <span className="muted">
                  High-confidence drafts are ready to submit; borderline calls
                  are flagged for review. One click sends to Stripe.
                </span>
              </div>
            </li>
          </ol>

          <div className="hiw-foot muted">
            Tip: hover any priority badge or confidence bar for details.
          </div>
        </div>
      )}
    </div>
  );
}
