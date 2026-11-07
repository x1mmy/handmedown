"use client";

import { useMemo, useState } from "react";

import { ApiError, api } from "@/lib/client-api";
import { formatIngredientLines, parseIngredientLines } from "@/lib/ingredients";
import { COURSE_LABEL } from "@/lib/format";
import { COURSES, type Course, type RecipeDetail } from "@/lib/types";

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
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [handedDownBy, setHandedDownBy] = useState(recipe?.handedDownBy ?? "");
  const [course, setCourse] = useState<Course>(recipe?.course ?? "mains");
  const [minutes, setMinutes] = useState(String(recipe?.minutes ?? 30));
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [kitchenId, setKitchenId] = useState(recipe?.kitchenId ?? kitchens[0]?.id ?? "");
  const [note, setNote] = useState(recipe?.marginNote ?? "");
  const [ingredients, setIngredients] = useState(recipe ? formatIngredientLines(recipe.ingredients) : "");
  const [steps, setSteps] = useState(recipe?.steps.join("\n") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ id: string; version: number } | null>(
    recipe ? { id: recipe.id, version: recipe.version } : null,
  );
  const kitchenName = kitchens.find((kitchen) => kitchen.id === kitchenId)?.name ?? "Kitchen";

  const previewNote = useMemo(() => note.trim(), [note]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const body = {
        kitchenId,
        title,
        handedDownBy,
        course,
        minutes: Number(minutes),
        servings: Number(servings),
        marginNote: note,
        ingredients: parseIngredientLines(ingredients),
        steps: steps
          .split("\n")
          .map((step) => step.trim())
          .filter(Boolean),
        version: identity?.version,
      };
      if (identity) {
        const result = await api<{ version: number }>(`/api/books/${bookId}/recipes/${identity.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setIdentity({ id: identity.id, version: result.version });
      } else {
        const result = await api<{ id: string }>(`/api/books/${bookId}/recipes`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setIdentity({ id: result.id, version: 1 });
      }
      setNotice("Saved");
    } catch (caught) {
      setNotice(null);
      if (caught instanceof ApiError && caught.status === 409) {
        setError("Someone else saved this recipe. Reload to see their version.");
      } else {
        setError(caught instanceof ApiError ? caught.message : "Could not save");
      }
    }
  }

  return (
    <form
      className="grid items-start gap-8 desk:grid-cols-2"
      onSubmit={(event) => void save(event)}
      onInput={() => {
        if (notice) setNotice(null);
      }}
    >
      <div>
        <p className="micro">Filing into {kitchenName}</p>
        <h2 className="mt-1 font-serif text-[28px] font-normal">{recipe ? "Edit recipe" : "Add a family recipe"}</h2>
        <Field label="Recipe title">
          <input className={input} value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Handed down by">
          <input className={input} value={handedDownBy} onChange={(event) => setHandedDownBy(event.target.value)} />
        </Field>
        <Field label="Kitchen">
          <select className={input} value={kitchenId} onChange={(event) => setKitchenId(event.target.value)}>
            {kitchens.map((kitchen) => (
              <option key={kitchen.id} value={kitchen.id}>
                {kitchen.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <Field label="Course">
            <select className={input} value={course} onChange={(event) => setCourse(event.target.value as Course)}>
              {COURSES.map((item) => (
                <option key={item} value={item}>
                  {COURSE_LABEL[item]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minutes">
            <input className={input} inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
          </Field>
        </div>
        <Field label="Servings">
          <input className={input} inputMode="numeric" value={servings} onChange={(event) => setServings(event.target.value)} />
        </Field>
        <Field label="Handwritten margin story">
          <textarea className={area} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field label="Ingredients, one per line">
          <textarea className={area} value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="1 1/4 cups pearl couscous" />
        </Field>
        <Field label="Method, one step per line">
          <textarea className={`${area} min-h-40`} value={steps} onChange={(event) => setSteps(event.target.value)} />
        </Field>
        {error ? (
          <p className="mb-3 text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-3">
          <button type="submit" className="inline-flex min-h-11 items-center border border-ink bg-ink px-5 text-[12px] font-medium uppercase tracking-[0.08em] text-sheet">
            Save to family book
          </button>
          {notice ? (
            <span role="status" className="text-sm">
              {notice}
            </span>
          ) : null}
        </p>
      </div>
      <div>
        <p className="micro mb-2">Live A5 page preview</p>
        <div className="flex aspect-[148/210] flex-col justify-between border border-rule bg-sheet p-6 desk:p-8">
          <div>
            <p className="micro">
              {COURSE_LABEL[course]} · {kitchenName} · {minutes || "0"} min
            </p>
            <h3 className="mt-2 font-serif text-[30px] font-normal leading-tight">{title || "Untitled recipe"}</h3>
            <p className="mt-2 font-serif italic text-inksoft">Handed down by {handedDownBy || "Family"}</p>
            {previewNote ? (
              <div className="tape relative mt-4 border border-noteborder bg-note px-4 py-3">
                <p className="font-hand text-[21px] leading-snug text-handink">{previewNote}</p>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between border-t border-rule pt-3">
            <span className="micro">{bookTitle}</span>
            <span className="micro">A5</span>
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="micro mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const input = "w-full border-b border-ink bg-transparent py-2 outline-none";
const area = "min-h-24 w-full border border-rule bg-sheet p-3 outline-none";
