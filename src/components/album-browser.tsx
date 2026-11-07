"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { tween } from "@/components/motion";

import type { AlbumView } from "@/lib/types";

export function AlbumBrowser({
  bookId,
  albums,
  kitchens,
}: {
  bookId: string;
  albums: AlbumView[];
  kitchens: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? "all");
  const [name, setName] = useState("");
  const [caption, setCaption] = useState("");
  const [kitchenId, setKitchenId] = useState(kitchens[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const visible = albumId === "all" ? albums.flatMap((album) => album.photos.map((photo) => ({ ...photo, album: album.name }))) : albums.find((album) => album.id === albumId)?.photos.map((photo) => ({ ...photo, album: albums.find((item) => item.id === albumId)?.name ?? "" })) ?? [];
  const count = albums.reduce((sum, album) => sum + album.photos.length, 0);

  async function createAlbum() {
    setError(null);
    const response = await fetch(`/api/books/${bookId}/albums`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = (await response.json()) as { message?: string; id?: string };
    if (!response.ok) {
      setError(body.message ?? "Could not create the album");
      return;
    }
    setName("");
    if (body.id) setAlbumId(body.id);
    router.refresh();
  }

  async function upload(file: File) {
    setError(null);
    const target = albumId === "all" ? albums[0]?.id : albumId;
    if (!target) {
      setError("Name an album before adding photos");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("albumId", target);
    form.set("caption", caption);
    if (kitchenId) form.set("kitchenId", kitchenId);
    const response = await fetch(`/api/books/${bookId}/media`, { method: "POST", body: form });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? "Unsafe upload rejected");
      return;
    }
    setCaption("");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <div className="flex flex-wrap gap-x-4">
          <button type="button" className={tab(albumId === "all")} onClick={() => setAlbumId("all")}>
            All photos ({count})
          </button>
          {albums.map((album) => (
            <button key={album.id} type="button" className={tab(albumId === album.id)} onClick={() => setAlbumId(album.id)}>
              {album.name}
            </button>
          ))}
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center border border-ink px-4 text-[12px] font-medium uppercase tracking-[0.08em]">
          Add photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 desk:grid-cols-[1fr_1fr_auto] desk:items-end">
        <label className="block">
          <span className="micro">New album name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="w-full border-b border-ink bg-transparent py-2 outline-none" />
        </label>
        <label className="block">
          <span className="micro">Caption for the next photo</span>
          <input value={caption} onChange={(event) => setCaption(event.target.value)} className="w-full border-b border-ink bg-transparent py-2 outline-none" />
        </label>
        <div className="flex gap-2">
          {kitchens.length > 0 ? (
            <select aria-label="Photo kitchen" value={kitchenId} onChange={(event) => setKitchenId(event.target.value)} className="min-h-11 border border-rule bg-sheet px-2">
              {kitchens.map((kitchen) => (
                <option key={kitchen.id} value={kitchen.id}>
                  {kitchen.name}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" onClick={() => void createAlbum()} className="inline-flex min-h-11 items-center border border-ink px-4 text-[12px] uppercase tracking-[0.08em]">
            Name album
          </button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}

      {visible.length === 0 ? (
        <p className="py-10 text-inksoft">This album is waiting for its first photograph.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 desk:grid-cols-4 desk:gap-7">
          {visible.map((photo, index) => (
            <motion.figure
              key={photo.id}
              className="relative border border-[#dfd9ce] bg-sheet px-3 pb-6 pt-3"
              initial={reduce ? false : { opacity: 0, y: 18, rotate: index % 2 ? 2.4 : -2.4 }}
              animate={{ opacity: 1, y: 0, rotate: index % 2 ? 1.1 : -1.1 }}
              transition={reduce ? { duration: 0 } : { ...tween(0.28), delay: Math.min(index, 8) * 0.04 }}
            >
              <span className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 bg-[rgba(230,219,194,0.72)]" />
              <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
              <figcaption className="mt-3 font-hand text-xl leading-snug text-handink">{photo.caption}</figcaption>
              <p className="micro mt-1">{photo.meta}</p>
            </motion.figure>
          ))}
        </div>
      )}
    </div>
  );
}

function tab(active: boolean) {
  return `inline-flex min-h-11 items-center text-[12px] uppercase tracking-[0.08em] ${
    active ? "font-semibold text-ink underline decoration-1 underline-offset-[6px]" : "text-inkmuted"
  }`;
}
