// components/sections/Contact.tsx
// "Get in Touch" — a CLI/terminal-style contact form.
// Input fields look like command-line prompts.

"use client";

import { useState, type FormEvent } from "react";
import { Send, Terminal, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ─── Form Fields Config ──────────────────────────────────────
const FORM_FIELDS = [
  {
    id:          "name",
    label:       "IDENTIFIER",
    prompt:      "user@zeko:~$",
    placeholder: "enter your full name...",
    type:        "text",
    required:    true,
  },
  {
    id:          "email",
    label:       "CHANNEL",
    prompt:      "email@zeko:~$",
    placeholder: "your.email@domain.com",
    type:        "email",
    required:    true,
  },
  {
    id:          "subject",
    label:       "SUBJECT",
    prompt:      "subj@zeko:~$",
    placeholder: "what is the mission objective?",
    type:        "text",
    required:    true,
  },
] as const;

type FieldId = "name" | "email" | "subject" | "message";

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ─── Component ──────────────────────────────────────────────
export function Contact() {
  const [formData, setFormData] = useState({
    name:    "",
    email:   "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldId, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [focused, setFocused] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id as FieldId]) {
      setErrors((prev) => ({ ...prev, [id]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<FieldId, string>> = {};

    if (!formData.name.trim())
      newErrors.name = "Error: name field cannot be empty";
    if (!formData.email.trim())
      newErrors.email = "Error: email field cannot be empty";
    else if (!validateEmail(formData.email))
      newErrors.email = "Error: invalid email address format";
    if (!formData.subject.trim())
      newErrors.subject = "Error: subject field cannot be empty";
    if (!formData.message.trim())
      newErrors.message = "Error: message payload cannot be empty";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus("loading");
    await new Promise((r) => setTimeout(r, 1800));
    setStatus("success");
  };

  return (
    <section id="contact" className="relative py-16 px-6">
      <div className="max-w-4xl mx-auto">

        {/* ── Section Header ─────────────────────────────── */}
        <div className="mb-16 text-center">
          <p className="section-label mb-3">// ESTABLISH_CONNECTION</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-zk-white leading-tight mb-4">
            Get in{" "}
            <span className="font-mono text-zk-green text-glow-sm">Touch</span>
          </h2>
          <p className="text-zk-slate text-lg max-w-xl mx-auto leading-relaxed">
            Open a communication channel. Whether it&apos;s a project brief,
            collaboration request, or technical inquiry — all signals received.
          </p>
        </div>

        {/* ── Terminal Form Container ─────────────────────── */}
        <div className="terminal-block shadow-[0_0_60px_rgba(0,255,65,0.06)]">

          {/* Window chrome */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zk-green/15 bg-[rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-zk-green" />
              <span className="font-mono text-xs text-zk-green/80 tracking-wider">
                zeko-os — contact.sh
              </span>
            </div>
            <span className="font-mono text-[10px] text-zk-muted">
              SECURE CHANNEL ACTIVE
            </span>
          </div>

          {/* Form body */}
          <div className="p-6 sm:p-8">

            {/* System boot log */}
            <div className="mb-6 font-mono text-xs text-zk-muted space-y-1">
              <p>
                <span className="text-zk-green">{">"}</span> Establishing secure
                connection to zeko@os...
              </p>
              <p>
                <span className="text-zk-green">{">"}</span> Connection verified.
                Fill in the required fields below.
              </p>
              <p className="text-zk-green/60">
                ─────────────────────────────────────────────
              </p>
            </div>

            {status === "success" ? (
              /* ── Success State ──────────────────────────── */
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <CheckCircle2 size={40} className="text-zk-green" />
                <div>
                  <p className="font-mono text-lg text-zk-green font-bold mb-1">
                    TRANSMISSION COMPLETE
                  </p>
                  <p className="font-mono text-sm text-zk-muted">
                    Message queued. Expect a response within 24–48 hours.
                  </p>
                </div>
                <div className="font-mono text-xs text-zk-muted/60 border border-zk-border rounded-sm px-4 py-2">
                  REF: ZK-{Math.random().toString(36).slice(2, 8).toUpperCase()}
                </div>
              </div>
            ) : (
              /* ── Form ──────────────────────────────────── */
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                {/* Text fields */}
                {FORM_FIELDS.map((field) => (
                  <div key={field.id}>
                    <label
                      htmlFor={field.id}
                      className="block font-mono text-[10px] text-zk-muted tracking-widest mb-2"
                    >
                      {field.label}
                      <span className="text-zk-green ml-1">*</span>
                    </label>

                    <div
                      className={cn(
                        "flex items-center gap-0 rounded-sm border transition-all duration-200",
                        "bg-[rgba(0,0,0,0.5)]",
                        errors[field.id as FieldId]
                          ? "border-zk-red shadow-[0_0_0_3px_rgba(255,59,59,0.10)]"
                          : focused === field.id
                          ? "border-zk-green shadow-[0_0_0_3px_rgba(0,255,65,0.10),_0_0_12px_rgba(0,255,65,0.15)]"
                          : "border-zk-border hover:border-zk-green/30"
                      )}
                    >
                      <span className="font-mono text-xs text-zk-green/60 px-3 py-3 border-r border-zk-border shrink-0 select-none">
                        {field.prompt}
                      </span>
                      <input
                        id={field.id}
                        type={field.type}
                        value={formData[field.id as keyof typeof formData]}
                        onChange={handleChange}
                        onFocus={() => setFocused(field.id)}
                        onBlur={() => setFocused(null)}
                        placeholder={field.placeholder}
                        className={cn(
                          "flex-1 bg-transparent px-3 py-3 outline-none",
                          "font-mono text-sm text-zk-white",
                          "placeholder:text-zk-muted/50"
                        )}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>

                    {errors[field.id as FieldId] && (
                      <p className="mt-1.5 font-mono text-[11px] text-zk-red flex items-center gap-1.5">
                        <AlertCircle size={10} />
                        {errors[field.id as FieldId]}
                      </p>
                    )}
                  </div>
                ))}

                {/* Message textarea */}
                <div>
                  <label
                    htmlFor="message"
                    className="block font-mono text-[10px] text-zk-muted tracking-widest mb-2"
                  >
                    PAYLOAD
                    <span className="text-zk-green ml-1">*</span>
                  </label>
                  <div
                    className={cn(
                      "rounded-sm border transition-all duration-200",
                      "bg-[rgba(0,0,0,0.5)]",
                      errors.message
                        ? "border-zk-red shadow-[0_0_0_3px_rgba(255,59,59,0.10)]"
                        : focused === "message"
                        ? "border-zk-green shadow-[0_0_0_3px_rgba(0,255,65,0.10),_0_0_12px_rgba(0,255,65,0.15)]"
                        : "border-zk-border hover:border-zk-green/30"
                    )}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-zk-border/60">
                      <span className="font-mono text-xs text-zk-green/60 select-none">
                        msg@zeko:~$
                      </span>
                      <span className="font-mono text-[10px] text-zk-muted/50">
                        — multiline input
                      </span>
                    </div>
                    <textarea
                      id="message"
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      onFocus={() => setFocused("message")}
                      onBlur={() => setFocused(null)}
                      placeholder="describe your mission, project requirements, or inquiry..."
                      className={cn(
                        "w-full bg-transparent px-4 py-3 outline-none resize-none",
                        "font-mono text-sm text-zk-white leading-relaxed",
                        "placeholder:text-zk-muted/50"
                      )}
                      spellCheck={false}
                    />
                  </div>

                  {errors.message && (
                    <p className="mt-1.5 font-mono text-[11px] text-zk-red flex items-center gap-1.5">
                      <AlertCircle size={10} />
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Submission error */}
                {status === "error" && (
                  <div className="flex items-center gap-2 font-mono text-xs text-zk-red bg-zk-red/8 border border-zk-red/20 rounded-sm px-3 py-2">
                    <AlertCircle size={12} />
                    TRANSMISSION FAILED — check your inputs and retry.
                  </div>
                )}

                {/* Submit */}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-[10px] text-zk-muted/60">
                    All fields marked * are required
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={status === "loading"}
                    rightIcon={<Send size={13} />}
                  >
                    {status === "loading" ? "Transmitting..." : "Send Signal"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Direct links ────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          {[
            { label: "Email",   value: "hello@zeko.os",   href: "mailto:hello@zeko.os" },
            { label: "GitHub",  value: "github.com/zeko", href: "https://github.com"   },
            { label: "Twitter", value: "@zeko_os",        href: "https://x.com"        },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block px-4 py-3 rounded-sm border border-zk-border",
                "hover:border-zk-green/30 hover:bg-zk-green/5",
                "transition-all duration-200 group"
              )}
            >
              <p className="font-mono text-[10px] text-zk-muted tracking-widest uppercase mb-1">
                {item.label}
              </p>
              <p className="font-mono text-sm text-zk-slate group-hover:text-zk-green transition-colors">
                {item.value}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
