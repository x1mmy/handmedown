"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiAddLine, RiCamera3Line, RiFolderAddLine } from "@remixicon/react";

import { BIG, Screen, ScreenHeader } from "@/components/app/screen";
import { Button } from "@/components/base/buttons/button";
import { Drawer, DrawerBody, DrawerHeader } from "@/components/base/drawer/drawer";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { toast } from "@/components/base/toast/toast";
import type { AlbumView } from "@/lib/types";
import { cx } from "@/utils/cx";

type Photo = AlbumView["photos"][number] & { album: string };

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
  const reduce = useReducedMotion();
  const [albumId, setAlbumId] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);

  const all: Photo[] = albums.flatMap((album) => album.photos.map((photo) => ({ ...photo, album: album.name })));
  const visible = albumId === "all" ? all : all.filter((photo) => albums.find((album) => album.id === albumId)?.photos.some((item) => item.id === photo.id));

  return (
    <Screen>
      <ScreenHeader
        title="Album"
        action={<Button iconOnly leadingIcon={RiAddLine} aria-label="Add a photo" className="size-11 rounded-full" onClick={() => setAddOpen(true)} />}
      />

      {albums.length > 0 ? (
        <div className="shelf mt-2 flex gap-2 overflow-x-auto px-4 lg:px-0">
          <Pill active={albumId === "all"} onClick={() => setAlbumId("all")}>
            All <span className="opacity-60">{all.length}</span>
          </Pill>
          {albums.map((album) => (
            <Pill key={album.id} active={albumId === album.id} onClick={() => setAlbumId(album.id)}>
              {album.name}
            </Pill>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="mx-4 mt-6 rounded-3xl bg-background-primary-default px-6 py-12 text-center shadow-card lg:mx-0">
          <p className="text-title-3-semibold text-text-primary">No photos yet</p>
          <p className="mt-1 text-body-regular text-text-secondary">Snap the next family dinner and add it here.</p>
          <Button leadingIcon={RiCamera3Line} onClick={() => setAddOpen(true)} className="mt-5 h-11 rounded-full px-5">
            Add a photo
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-0.5 sm:gap-1 lg:grid-cols-5 lg:gap-2">
          {visible.map((photo, index) => (
            <motion.button
              key={photo.id}
              type="button"
              aria-label={photo.caption || "Family photo"}
              onClick={() => setOpen(photo)}
              className="relative aspect-square overflow-hidden bg-background-tertiary-default outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring lg:rounded-xl"
              initial={reduce ? false : photo.id === freshId ? { opacity: 0, scale: 0.85 } : { opacity: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: photo.id === freshId ? 0 : Math.min(index, 12) * 0.02, ease: [0.32, 0.72, 0, 1] }}
            >
              <img src={photo.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 active:scale-95" />
            </motion.button>
          ))}
        </div>
      )}

      <Drawer placement="bottom" isOpen={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        {open ? (
          <>
            <DrawerHeader title={open.album} description={open.meta} />
            <DrawerBody>
              <img src={open.url} alt={open.caption || "Family photo"} className="max-h-[55dvh] w-full rounded-2xl object-contain" />
              {open.caption ? <p className="mt-3 pb-[env(safe-area-inset-bottom)] font-hand text-title-1-medium text-accent-800">{open.caption}</p> : null}
            </DrawerBody>
          </>
        ) : null}
      </Drawer>

      <AddPhotoSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        bookId={bookId}
        albums={albums}
        kitchens={kitchens}
        defaultAlbumId={albumId === "all" ? albums[0]?.id : albumId}
        onAdded={(photoId, targetAlbum) => {
          setFreshId(photoId);
          setAlbumId(targetAlbum);
          setAddOpen(false);
          toast.success("Photo added");
          router.refresh();
        }}
        onAlbumCreated={(id) => {
          setAlbumId(id);
          router.refresh();
        }}
      />
    </Screen>
  );
}

function AddPhotoSheet({
  open,
  onOpenChange,
  bookId,
  albums,
  kitchens,
  defaultAlbumId,
  onAdded,
  onAlbumCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  albums: AlbumView[];
  kitchens: { id: string; name: string }[];
  defaultAlbumId?: string;
  onAdded: (photoId: string, albumId: string) => void;
  onAlbumCreated: (albumId: string) => void;
}) {
  const [target, setTarget] = useState(defaultAlbumId ?? "");
  const [caption, setCaption] = useState("");
  const [kitchenId, setKitchenId] = useState(kitchens[0]?.id ?? "");
  const [newAlbum, setNewAlbum] = useState("");
  const [naming, setNaming] = useState(albums.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const albumTarget = target || defaultAlbumId || albums[0]?.id || "";

  async function createAlbum(): Promise<string | null> {
    setError(null);
    try {
      const response = await fetch(`/api/books/${bookId}/albums`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newAlbum }),
      });
      const body = (await response.json()) as { message?: string; id?: string };
      if (!response.ok || !body.id) {
        setError(body.message ?? "Could not create the album");
        return null;
      }
      setNewAlbum("");
      setNaming(false);
      setTarget(body.id);
      onAlbumCreated(body.id);
      return body.id;
    } catch {
      setError("The album was not created. Check the connection and try again.");
      return null;
    }
  }

  async function upload(file: File) {
    setError(null);
    setPendingFile(file);
    let destination = albumTarget;
    if (naming && newAlbum.trim()) destination = (await createAlbum()) ?? "";
    if (!destination) {
      setError("Name an album first.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("albumId", destination);
    form.set("caption", caption);
    if (kitchenId) form.set("kitchenId", kitchenId);
    setBusy(true);
    try {
      const response = await fetch(`/api/books/${bookId}/media`, { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { message?: string; photoId?: string };
      if (!response.ok) {
        setError(body.message ?? "That file could not be used. Try a JPEG, PNG or WebP photo.");
        return;
      }
      setCaption("");
      setPendingFile(null);
      onAdded(body.photoId ?? "", destination);
    } catch {
      setError("The photo was not saved. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer placement="bottom" isOpen={open} onOpenChange={onOpenChange}>
      <DrawerHeader title="Add a photo" description="It goes straight into the family album." />
      <DrawerBody>
        <div className="grid gap-4 pb-[env(safe-area-inset-bottom)]">
          {naming ? (
            <Input label="New album" placeholder="Eid 2026" value={newAlbum} onChange={setNewAlbum} fieldClassName="h-11" />
          ) : (
            <div className="flex items-end gap-2">
              <Select label="Album" value={albumTarget} onChange={(key) => key && setTarget(String(key))} className="flex-1" triggerClassName="h-11">
                {albums.map((album) => (
                  <SelectItem key={album.id} id={album.id}>
                    {album.name}
                  </SelectItem>
                ))}
              </Select>
              <Button variant="secondary" iconOnly leadingIcon={RiFolderAddLine} aria-label="New album" className="size-11 rounded-xl" onClick={() => setNaming(true)} />
            </div>
          )}
          <Input label="Caption" placeholder="Nan's Friday salmon" value={caption} onChange={setCaption} fieldClassName="h-11" />
          {kitchens.length > 1 ? (
            <Select label="Kitchen" value={kitchenId} onChange={(key) => key && setKitchenId(String(key))} triggerClassName="h-11">
              {kitchens.map((kitchen) => (
                <SelectItem key={kitchen.id} id={kitchen.id}>
                  {kitchen.name}
                </SelectItem>
              ))}
            </Select>
          ) : null}
          {error ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-background-tertiary-error px-4 py-3 text-body-medium text-text-error-primary">
              <span>{error}</span>
              {pendingFile ? (
                <Button variant="secondary" size="small" onClick={() => void upload(pendingFile)}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}
          <label
            className={cx(
              BIG,
              "flex cursor-pointer items-center justify-center gap-2 bg-button-primary text-text-white shadow-xs focus-within:ring-2 focus-within:ring-border-focus-ring",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <RiCamera3Line className="size-5" aria-hidden />
            {busy ? "Uploading" : "Choose a photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
        </div>
      </DrawerBody>
    </Drawer>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-body-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        active ? "bg-accent-50 text-accent-700" : "bg-background-primary-default text-text-secondary shadow-card hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}
