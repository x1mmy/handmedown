"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PushRow, tween } from "@/components/motion";

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
  const [status, setStatus] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const visible = albumId === "all" ? albums.flatMap((album) => album.photos.map((photo) => ({ ...photo, album: album.name }))) : albums.find((album) => album.id === albumId)?.photos.map((photo) => ({ ...photo, album: albums.find((item) => item.id === albumId)?.name ?? "" })) ?? [];
  const count = albums.reduce((sum, album) => sum + album.photos.length, 0);

  async function createAlbum() {
    setError(null);
    try {
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
    } catch {
      setError("The album was not created. Check the connection and retry.");
    }
  }

  async function upload(file: File) {
    setError(null);
    setPendingFile(file);
    const target = albumId === "all" ? albums[0]?.id : albumId;
    if (!target) {
      setStatus("Failed");
      setError("Name an album before adding photos");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("albumId", target);
    form.set("caption", caption);
    if (kitchenId) form.set("kitchenId", kitchenId);
    setStatus("Uploading…");
    try {
      const response = await fetch(`/api/books/${bookId}/media`, { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { message?: string; photoId?: string };
      if (!response.ok) {
        setStatus("Failed");
        setError(body.message ?? "Unsafe upload rejected");
        return;
      }
      if (body.photoId) setFreshId(body.photoId);
      setCaption("");
      setPendingFile(null);
      setStatus(null);
      router.refresh();
    } catch {
      setStatus("Failed");
      setError("The photograph was not saved. Check the connection and retry.");
    }
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
            }}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 desk:grid-cols-[1fr_1fr_auto] desk:items-end">
        <label className="block">
          <span className="micro">New album name</span>
          <input aria-label="New album name" value={name} onChange={(event) => setName(event.target.value)} className="min-h-11 w-full border-b border-ink bg-transparent py-2 text-base focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent" />
        </label>
        <label className="block">
          <span className="micro">Caption for the next photo</span>
          <input aria-label="Caption for the next photo" value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-11 w-full border-b border-ink bg-transparent py-2 text-base focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent" />
        </label>
        <div className="flex gap-2">
          {kitchens.length > 0 ? (
            <select aria-label="Photo kitchen" value={kitchenId} onChange={(event) => setKitchenId(event.target.value)} className="min-h-11 min-w-0 max-w-full border border-rule bg-sheet px-2 text-base">
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
      {status && status !== "Failed" ? <p className="mt-3 text-sm" role="status">{status}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-accent">
          <span>{error}</span>
          <button
            type="button"
            className="inline-flex min-h-11 items-center border border-ink px-4 text-[12px] uppercase tracking-[0.08em] text-ink"
            onClick={() => void (pendingFile ? upload(pendingFile) : createAlbum())}
          >
            Retry
          </button>
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-10 text-inksoft">This album is waiting for its first photograph.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 desk:grid-cols-4 desk:gap-7">
          {visible.map((photo) => {
            const fresh = photo.id === freshId;
            return (
              <PushRow key={photo.id} fresh={fresh}>
                <motion.figure
                  className="relative border border-[#dfd9ce] bg-sheet px-3 pb-6 pt-3"
                  initial={fresh && !reduce ? { opacity: 0, rotate: 3 } : false}
                  animate={{ opacity: 1, rotate: 1 }}
                  transition={reduce ? { duration: 0 } : tween(0.2)}
                >
                  <span className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 bg-[rgba(230,219,194,0.72)]" />
                  <img src={photo.url} alt={photo.caption || "Family photograph"} className="aspect-square w-full object-cover" />
                  <TypedCaption text={photo.caption} play={fresh} />
                  <p className="micro mt-1">{photo.meta}</p>
                </motion.figure>
              </PushRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TypedCaption({ text, play }: { text: string; play: boolean }) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(play && !reduce ? 0 : text.length);

  useEffect(() => {
    if (!play || reduce) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const step = Math.max(16, Math.floor(280 / Math.max(text.length, 1)));
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setCount(index);
      if (index >= text.length) window.clearInterval(timer);
    }, step);
    return () => window.clearInterval(timer);
  }, [play, reduce, text]);

  return (
    <figcaption className="mt-3 min-h-[1.6em] font-hand text-xl leading-snug text-handink" aria-label={text}>
      {text.slice(0, count)}
    </figcaption>
  );
}

function tab(active: boolean) {
  return `inline-flex min-h-11 min-w-11 items-center justify-center text-[12px] uppercase tracking-[0.08em] ${
    active ? "font-semibold text-ink underline decoration-1 underline-offset-[6px]" : "text-inkmuted"
  }`;
}
