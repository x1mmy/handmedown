"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { PushRow, tween } from "@/components/motion";
import type { KitchenDesk } from "@/lib/types";

export function KitchenManager({ bookId, desk }: { bookId: string; desk: KitchenDesk }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const reduce = useReducedMotion();

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
            <h3 className="font-serif text-2xl font-normal">{kitchen.name}</h3>
            <p className="micro">{kitchen.myRole ? `You are ${kitchen.myRole}` : "Not your kitchen"} · {kitchen.contentCount} attached</p>
          </div>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {kitchen.members.map((member) => {
              const fresh = member.userId === incoming;
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
            {!kitchen.myRole && desk.access !== "guest" ? (
              <>
                <button
                  type="button"
                  className={line}
                  onClick={() =>
                    void send(`/api/books/${bookId}/join-requests`, {
                      method: "POST",
                      body: JSON.stringify({ kitchenId: kitchen.id }),
                    }).then((body) => {
                      if (body) setAsked(kitchen.id);
                    })
                  }
                >
                  Ask to join
                </button>
                {asked === kitchen.id ? (
                  <span role="status" className="text-sm">
                    Request sent
                  </span>
                ) : null}
              </>
            ) : null}
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
          {kitchen.pendingRequests.length > 0 ? (
            <ul className="mt-4">
              {kitchen.pendingRequests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-rule py-2">
                  <span>{request.name} asked to join</span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className={solid}
                      onClick={() => {
                        setIncoming(request.userId);
                        void send(`/api/join-requests/${request.id}/approve`, { method: "POST" });
                      }}
                    >
                      Approve
                    </button>
                    <button type="button" className={line} onClick={() => void send(`/api/join-requests/${request.id}/reject`, { method: "POST" })}>
                      Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      {desk.access === "owner" ? (
        <section className="border border-rule p-5">
          <h3 className="font-serif text-2xl font-normal">Add a kitchen</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Kitchen name" className="min-h-11 flex-1 border-b border-ink bg-transparent" />
            <button
              type="button"
              className={solid}
              onClick={() => void send(`/api/books/${bookId}/kitchens`, { method: "POST", body: JSON.stringify({ name }) }).then(() => setName(""))}
            >
              Create kitchen
            </button>
          </div>
          <h3 className="mt-8 font-serif text-2xl font-normal">Invites</h3>
          <p className="mt-1 text-sm text-inksoft">An invite lets someone read the book. Joining a kitchen still needs approval.</p>
          <button
            type="button"
            className={`${solid} mt-3`}
            onClick={() =>
              void send(`/api/books/${bookId}/invites`, { method: "POST" }).then((body) => {
                if (body?.token && typeof window !== "undefined") {
                  setInvite(`${window.location.origin}/invite/${body.token}`);
                }
              })
            }
          >
            Create invite link
          </button>
          {invite ? <p className="mt-3 break-all text-sm">{invite}</p> : null}
          <ul className="mt-4 divide-y divide-rule">
            {desk.invites.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {item.revokedAt ? "Revoked" : item.redeemedByName ? `Redeemed by ${item.redeemedByName}` : "Open"}
                </span>
                {!item.revokedAt ? (
                  <button type="button" className={line} onClick={() => void send(`/api/invites/${item.id}/revoke`, { method: "POST" })}>
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
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
