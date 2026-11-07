"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiCamera3Line } from "@remixicon/react";

import { BIG } from "@/components/app/screen";
import { BackButton } from "@/components/book-controls";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea/textarea";
import { toast } from "@/components/base/toast/toast";
import { ApiError, api } from "@/lib/client-api";
import { formatIngredientLines, parseIngredientLines } from "@/lib/ingredients";
import { COURSE_LABEL } from "@/lib/format";
import { COURSES, type Course, type RecipeDetail } from "@/lib/types";
import { cx } from "@/utils/cx";

export function RecipeEditor({
  bookId,
  bookTitle,
  kitchens,
  recipe,
}: {
  bookId: string;
  bookTitle: string;
  kitchens: { id: string; name: string }[];
  recipe?: RecipeDetail;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [handedDownBy, setHandedDownBy] = useState(recipe?.handedDownBy ?? "");
  const [recipeBy, setRecipeBy] = useState(recipe?.recipeBy ?? "");
  const [deviceName, setDeviceName] = useState("");
  const [course, setCourse] = useState<Course>(recipe?.course ?? "mains");
  const [minutes, setMinutes] = useState(String(recipe?.minutes ?? 30));
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [kitchenId, setKitchenId] = useState(recipe?.kitchenId ?? kitchens[0]?.id ?? "");
  const [note, setNote] = useState(recipe?.marginNote ?? "");
  const [ingredients, setIngredients] = useState(recipe ? formatIngredientLines(recipe.ingredients) : "");
  const [steps, setSteps] = useState(recipe?.steps.join("\n") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const shownPhoto = photoPreview ?? (removePhoto ? null : (recipe?.heroUrl ?? null));
  const kitchenName = kitchens.find((kitchen) => kitchen.id === kitchenId)?.name ?? "Kitchen";

  useEffect(() => {
    const storedBy = localStorage.getItem("hmd-recipe-by") ?? "";
    setDeviceName(localStorage.getItem("hmd-device-name") ?? "");
    if (!recipe?.recipeBy && storedBy) setRecipeBy(storedBy);
  }, [recipe?.recipeBy]);

  // Free the preview blob when it is replaced or the screen closes.
  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function pickPhoto(file: File) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
  }

  async function savePhoto(id: string): Promise<boolean> {
    try {
      if (photoFile) {
        const form = new FormData();
        form.set("file", photoFile);
        const response = await fetch(`/api/books/${bookId}/recipes/${id}/photo`, { method: "POST", body: form });
        return response.ok;
      }
      if (removePhoto && recipe?.heroUrl) {
        const response = await fetch(`/api/books/${bookId}/recipes/${id}/photo`, { method: "DELETE" });
        return response.ok;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Give the recipe a name.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        kitchenId,
        title,
        handedDownBy,
        recipeBy,
        course,
        minutes: Number(minutes),
        servings: Number(servings),
        marginNote: note,
        ingredients: parseIngredientLines(ingredients),
        steps: steps
          .split("\n")
          .map((step) => step.trim())
          .filter(Boolean),
        version: recipe?.version,
      };
      const id = recipe
        ? (await api<{ version: number }>(`/api/books/${bookId}/recipes/${recipe.id}`, { method: "PATCH", body: JSON.stringify(body) }), recipe.id)
        : (await api<{ id: string }>(`/api/books/${bookId}/recipes`, { method: "POST", body: JSON.stringify(body) })).id;
      if (recipeBy.trim()) localStorage.setItem("hmd-recipe-by", recipeBy.trim());
      if (deviceName.trim()) localStorage.setItem("hmd-device-name", deviceName.trim());
      if (await savePhoto(id)) toast.success(recipe ? "Changes saved" : "Added to the book");
      else toast.error("Recipe saved, but the photo did not upload. Try again from Edit.");
      router.push(`/recipes/${id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? "Someone else saved this recipe a moment ago. Reload to see their version."
          : caught instanceof ApiError
            ? caught.message
            : "Could not save. Check the connection and try again.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-6xl lg:px-8">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-background-secondary-default/85 px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 backdrop-blur-xl lg:top-16 lg:px-0 lg:pt-6">
        <BackButton fallback={recipe ? `/recipes/${recipe.id}` : "/"} />
        <p className="truncate text-headline-semibold text-text-primary">{recipe ? "Edit recipe" : "New recipe"}</p>
        <Button type="submit" form="recipe-form" size="small" disabled={saving} className="rounded-full px-3">
          Save
        </Button>
      </header>

      <form id="recipe-form" noValidate onSubmit={(event) => void save(event)} className="grid items-start gap-8 px-4 pt-4 lg:grid-cols-[1fr_380px] lg:gap-10 lg:px-0">
        <div className="grid gap-6">
          <section id="photo" aria-label="Photo" className="scroll-mt-24">
            <input
              ref={picker}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) pickPhoto(file);
              }}
            />
            {shownPhoto ? (
              <div className="overflow-hidden rounded-3xl bg-background-primary-default shadow-card">
                <img src={shownPhoto} alt="Recipe photo" className="aspect-[4/3] w-full object-cover" />
                <div className="flex gap-2 p-3">
                  <Button type="button" variant="secondary" leadingIcon={RiCamera3Line} className="h-11 flex-1 rounded-xl" onClick={() => picker.current?.click()}>
                    Change
                  </Button>
                  <Button type="button" variant="secondary" className="h-11 flex-1 rounded-xl" onClick={clearPhoto}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => picker.current?.click()}
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border-button-hover bg-background-primary-default text-text-secondary outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                  <RiCamera3Line className="size-7" aria-hidden />
                </span>
                <span className="text-headline-semibold text-text-primary">Add a photo</span>
                <span className="text-body-regular">Take one or pick from your library</span>
              </button>
            )}
          </section>

          <Card title="The dish">
            <Input label="Recipe name" value={title} onChange={setTitle} isRequired fieldClassName="h-11" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Course" value={course} onChange={(key) => key && setCourse(key as Course)} triggerClassName="h-11">
                {COURSES.map((item) => (
                  <SelectItem key={item} id={item}>
                    {COURSE_LABEL[item]}
                  </SelectItem>
                ))}
              </Select>
              <Select label="Kitchen" value={kitchenId} onChange={(key) => key && setKitchenId(String(key))} triggerClassName="h-11">
                {kitchens.map((kitchen) => (
                  <SelectItem key={kitchen.id} id={kitchen.id}>
                    {kitchen.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Minutes" inputMode="numeric" value={minutes} onChange={setMinutes} fieldClassName="h-11" />
              <Input label="Serves" inputMode="numeric" value={servings} onChange={setServings} fieldClassName="h-11" />
            </div>
          </Card>

          <Card title="Who it comes from">
            <Input label="Handed down by" hint="Who the family learned it from." value={handedDownBy} onChange={setHandedDownBy} fieldClassName="h-11" />
            <Input label="Recipe by" value={recipeBy} onChange={setRecipeBy} fieldClassName="h-11" />
            <Input label="Your name on this phone" hint="Only kept on this device." value={deviceName} onChange={setDeviceName} fieldClassName="h-11" />
          </Card>

          <Card title="Margin note">
            <Textarea
              label="A tip or a story, in their words"
              hint="Shows on the recipe in handwriting."
              value={note}
              onChange={setNote}
              rows={3}
              autoResize
            />
          </Card>

          <Card title="Ingredients">
            <Textarea
              label="One per line"
              hint="Amount first, like 1 1/4 cups pearl couscous. Fractions scale with servings."
              value={ingredients}
              onChange={setIngredients}
              rows={6}
              autoResize
            />
          </Card>

          <Card title="Method">
            <Textarea label="One step per line" value={steps} onChange={setSteps} rows={8} autoResize />
          </Card>

          {error ? (
            <p role="alert" className="rounded-2xl bg-background-tertiary-error px-4 py-3 text-body-medium text-text-error-primary">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={saving} className={cx(BIG, "w-full")}>
            {saving ? "Saving" : recipe ? "Save changes" : "Add to the book"}
          </Button>
        </div>

        <aside className="hidden lg:sticky lg:top-40 lg:block" aria-label="Printed page preview">
          <p className="mb-2 text-body-medium text-text-secondary">How it prints</p>
          <div className="flex aspect-[148/210] flex-col justify-between rounded-lg bg-background-primary-default p-7 shadow-lg">
            <div>
              <p className="text-caption-1-medium text-text-secondary">
                {COURSE_LABEL[course]}, {kitchenName}, {minutes || "0"} min
              </p>
              <h3 className="mt-2 text-title-1-semibold text-text-primary">{title || "Untitled recipe"}</h3>
              <p className="mt-2 text-body-regular text-text-secondary">Handed down by {handedDownBy || "the family"}</p>
              {deviceName.trim() ? <p className="mt-1 text-caption-1-regular text-text-tertiary">Last edited by {deviceName.trim()}</p> : null}
              {note.trim() ? <p className="mt-4 font-hand text-title-3-medium text-accent-800">{note.trim()}</p> : null}
            </div>
            <div className="flex items-center justify-between border-t border-separator-border pt-3 text-caption-1-medium text-text-secondary">
              <span>{bookTitle}</span>
              <span>A5</span>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-3xl bg-background-primary-default p-4 shadow-card">
      <legend className="float-left text-title-3-semibold text-text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}
