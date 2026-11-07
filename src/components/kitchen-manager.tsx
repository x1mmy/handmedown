"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineName } from "@/components/book-controls";
import { PushRow, tween } from "@/components/motion";
import type { KitchenDesk } from "@/lib/types";

export function KitchenManager({ bookId, desk }: { bookId: string; desk: KitchenDesk }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const knownMembers = useRef<Set<string> | null>(null);

  useEffect(() => {
    const next = new Set<string>();
    for (const kitchen of desk.kitchens) {
      for (const member of kitchen.members) next.add(`${kitchen.id}:${member.userId}`);
    }
    knownMembers.current = next;
  }, [desk]);

  async function send(url: string, init?: RequestInit) {
    setError(null);
    const response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await response.json().catch(() => ({}))) as { message?: string; token?: string };
    if (!response.ok) {
      setError(body.message ?? "That did not work");
      return null;
    }
    router.refresh();
    return body;
  }

  return (
    <div className="grid gap-8">
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      {desk.kitchens.map((kitchen) => (
        <section key={kitchen.id} className="border border-rule bg-sheet p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="min-w-0 font-serif text-2xl font-normal">
              <InlineName
                value={kitchen.name}
                label={`Kitchen name for ${kitchen.name}`}
                displayClass="font-serif text-2xl font-normal"
                save={async (next) => {
                  const response = await fetch(`/api/books/${bookId}/kitchens/${kitchen.id}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name: next }),
                  });
                  if (!response.ok) {
                    const body = (await response.json().catch(() => ({}))) as { message?: string };
                    throw new Error(body.message || "Could not rename the kitchen");
                  }
                }}
              />
            </h3>
            <p className="micro">{kitchen.myRole ? `You are ${kitchen.myRole}` : "Not your kitchen"} · {kitchen.contentCount} attached</p>
          </div>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {kitchen.members.map((member) => {
              const fresh = knownMembers.current !== null && !knownMembers.current.has(`${kitchen.id}:${member.userId}`);
              return (
                <li key={member.userId}>
                  <PushRow fresh={fresh}>
                    <div className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <motion.span
                          aria-hidden
                          className="inline-flex h-7 w-7 items-center justify-center border border-rule bg-paper text-[11px]"
                          initial={fresh && !reduce ? { x: -12, opacity: 0 } : false}
                          animate={{ x: 0, opacity: 1 }}
                          transition={reduce ? { duration: 0 } : tween(0.22)}
                        >
                          {initials(member.name)}
                        </motion.span>
                        <span>{member.name}</span>
                      </span>
                      <span className="micro">{member.role}</span>
                    </div>
                  </PushRow>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {desk.access === "owner" ? (
              <button
                type="button"
                className={line}
                onClick={() => void send(`/api/books/${bookId}/kitchens/${kitchen.id}`, { method: "DELETE" })}
              >
                Delete kitchen
              </button>
            ) : null}
          </div>
        </section>
      ))}

      {desk.access === "owner" ? (
        <section className="border border-rule p-5">
          <h3 className="font-serif text-2xl font-normal">Add a kitchen</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Kitchen name" aria-label="New kitchen name" className="min-h-11 min-w-0 flex-1 border-b border-ink bg-transparent text-base" />
            <button
              type="button"
              className={solid}
              onClick={() => void send(`/api/books/${bookId}/kitchens`, { method: "POST", body: JSON.stringify({ name }) }).then(() => setName(""))}
            >
              Create kitchen
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "•";
}

const solid = "inline-flex min-h-11 items-center border border-ink bg-ink px-4 text-[12px] font-medium uppercase tracking-[0.08em] text-sheet";
const line = "inline-flex min-h-11 items-center border border-ink px-4 text-[12px] font-medium uppercase tracking-[0.08em]";
