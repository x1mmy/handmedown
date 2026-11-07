"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiArrowRightSLine, RiDeleteBinLine } from "@remixicon/react";

import { InlineName } from "@/components/book-controls";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Input } from "@/components/base/input/input";
import { toast } from "@/components/base/toast/toast";
import type { KitchenDesk } from "@/lib/types";

export function KitchenManager({ bookId, desk }: { bookId: string; desk: KitchenDesk }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const owner = desk.access === "owner";

  async function send(url: string, init?: RequestInit): Promise<boolean> {
    const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      toast.error(body.message ?? "That did not work");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="mt-6 grid gap-4 px-4 lg:mt-8 lg:grid-cols-2 lg:gap-6 lg:px-0 xl:grid-cols-3">
      {desk.kitchens.map((kitchen) => (
        <section key={kitchen.id} className="rounded-3xl bg-background-primary-default p-4 shadow-card lg:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1">
              <InlineName
                value={kitchen.name}
                label={`Kitchen name for ${kitchen.name}`}
                displayClass="text-title-2-semibold text-text-primary"
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
            </h2>
            {owner ? (
              <IconButton
                icon={RiDeleteBinLine}
                aria-label={`Delete ${kitchen.name}`}
                onClick={() => {
                  if (window.confirm(`Delete ${kitchen.name}? Only empty kitchens can be deleted.`)) {
                    void send(`/api/books/${bookId}/kitchens/${kitchen.id}`, { method: "DELETE" });
                  }
                }}
              />
            ) : null}
          </div>

          {kitchen.members.length > 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {kitchen.members.slice(0, 5).map((member) => (
                  <Avatar key={member.userId} initials={initials(member.name)} alt={member.name} className="text-caption-1-semibold ring-2 ring-background-primary-default" />
                ))}
              </div>
              <span className="truncate text-body-regular text-text-secondary lg:text-headline-regular">{kitchen.members.map((member) => member.name).join(", ")}</span>
            </div>
          ) : null}

          <Link
            href={`/?kitchen=${kitchen.id}`}
            className="mt-4 flex h-12 items-center justify-between rounded-2xl bg-background-secondary-default px-4 text-headline-medium text-text-primary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <span>
              {kitchen.contentCount} {kitchen.contentCount === 1 ? "recipe or photo" : "recipes and photos"}
            </span>
            <RiArrowRightSLine className="size-5 text-foreground-icon-tertiary rtl:-scale-x-100" aria-hidden />
          </Link>
        </section>
      ))}

      {owner ? (
        <form
          className="rounded-3xl border border-dashed border-border-button-hover p-4 lg:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            void send(`/api/books/${bookId}/kitchens`, { method: "POST", body: JSON.stringify({ name }) }).then((ok) => {
              if (ok) {
                setName("");
                toast.success("Kitchen added");
              }
            });
          }}
        >
          <p className="text-title-3-semibold text-text-primary">Add a kitchen</p>
          <p className="mt-0.5 text-body-regular text-text-secondary lg:text-headline-regular">For another household in the family.</p>
          <div className="mt-4 flex items-end gap-2">
            <Input aria-label="New kitchen name" placeholder="Nan's Kitchen" value={name} onChange={setName} className="flex-1" fieldClassName="h-11" />
            <Button type="submit" className="h-11 rounded-xl px-4">
              Add
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}
