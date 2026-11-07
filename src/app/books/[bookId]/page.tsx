import Link from "next/link";

import { lineClass, solidClass } from "@/components/chrome";
import { COURSE_LABEL, formatMinutes } from "@/lib/format";
import { COURSES, type Course } from "@/lib/types";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

function isCourse(value: string | undefined): value is Course {
  return Boolean(value && (COURSES as readonly string[]).includes(value));
}

export default async function RecipesPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ course?: string; q?: string; kitchen?: string }>;
}) {
  const { bookId } = await params;
  const query = await searchParams;
  const { repo, principal, book } = await loadBook(bookId);
  const course = isCourse(query.course) ? query.course : "all";
  const recipes = await repo.listRecipes(principal, bookId, {
    course,
    query: query.q,
    kitchenId: query.kitchen || undefined,
  });
  const hero = recipes[0];
  const hrefFor = (nextCourse: string) => {
    const params = new URLSearchParams();
    if (nextCourse !== "all") params.set("course", nextCourse);
    if (query.q) params.set("q", query.q);
    if (query.kitchen) params.set("kitchen", query.kitchen);
    const suffix = params.toString();
    return `/books/${bookId}${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <main className="mx-auto w-full max-w-page px-4 py-6 desk:px-6 desk:py-8">
      {book.recipeCount === 0 ? (
        <section className="border border-rule bg-sheet px-5 py-10">
          <p className="micro">Empty book</p>
          <h2 className="mt-2 font-serif text-3xl font-normal">This book is still blank</h2>
          <p className="mt-2 max-w-md text-inksoft">Add the first recipe your kitchen actually cooks.</p>
          <Link href={`/books/${bookId}/recipes/new`} className={`${solidClass()} mt-6`}>
            Add a family recipe
          </Link>
        </section>
      ) : null}

      {hero ? (
        <section className="grid items-center gap-6 border-b border-rule pb-8 desk:grid-cols-[1.15fr_1fr] desk:gap-9">
          <div className="border border-rule bg-sheet p-2.5">
            {hero.heroUrl ? (
              <img src={hero.heroUrl} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-end bg-sheet p-5">
                <p className="font-hand text-[22px] leading-snug text-handink">{hero.marginNote}</p>
              </div>
            )}
          </div>
          <div>
            <p className="micro text-accent">Most cooked · Made {hero.cookedCount} times</p>
            <h2 className="mt-2 font-serif text-[32px] font-normal leading-[1.12] tracking-[-0.015em] desk:text-[42px]">
              {hero.title}
            </h2>
            <p className="mt-2 font-serif text-[17px] italic text-inksoft">
              Handed down by {hero.handedDownBy} · {hero.kitchenName} · {formatMinutes(hero.minutes)} · Serves {hero.servings}
            </p>
            {hero.marginNote ? (
              <div className="tape relative mt-4 max-w-md border border-noteborder bg-note px-4 py-3">
                <p className="font-hand text-[21px] leading-snug text-handink">&ldquo;{hero.marginNote}&rdquo;</p>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/books/${bookId}/recipes/${hero.id}`} className={solidClass()}>
                Open recipe
              </Link>
              <Link href={`/books/${bookId}/recipes/new`} className={lineClass()}>
                Add a family recipe
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <form className="flex flex-wrap items-end justify-between gap-4 border-b border-rule py-4" action={`/books/${bookId}`}>
        {query.kitchen ? <input type="hidden" name="kitchen" value={query.kitchen} /> : null}
        {course !== "all" ? <input type="hidden" name="course" value={course} /> : null}
        <div className="flex flex-wrap gap-x-4">
          {(["all", ...COURSES] as const).map((item) => (
            <Link
              key={item}
              href={hrefFor(item)}
              className={`inline-flex min-h-11 items-center text-[12px] uppercase tracking-[0.08em] ${
                course === item ? "font-semibold text-ink underline decoration-1 underline-offset-[6px]" : "text-inkmuted"
              }`}
            >
              {item === "all" ? `All (${book.recipeCount})` : COURSE_LABEL[item]}
            </Link>
          ))}
        </div>
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Search dish, ingredient, person"
          aria-label="Search recipes"
          className="w-full border-b border-inkmuted bg-transparent py-2 outline-none focus:border-ink desk:w-72"
        />
      </form>

      {book.recipeCount > 0 && recipes.length === 0 ? (
        <p className="py-10 text-inksoft">Nothing in the book matches.</p>
      ) : null}

      <div className="grid grid-cols-1 border-l border-rule desk:grid-cols-3">
        {recipes.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/books/${bookId}/recipes/${recipe.id}`}
            className={`dog-ear relative flex flex-col justify-between border-b border-r border-rule p-5 hover:bg-sheet/70 ${
              recipe.favourite ? "" : "before:hidden"
            } ${recipe.favourite ? "" : "[&::after]:hidden"}`}
          >
            {recipe.heroUrl ? (
              <img src={recipe.heroUrl} alt="" className="mb-4 aspect-[4/3] w-full border border-rule object-cover" />
            ) : (
              <div className="mb-4 flex aspect-[4/3] flex-col justify-between border border-rule bg-sheet p-4">
                <span className="micro">Index card · No photo</span>
                <p className="font-hand text-xl leading-snug text-handink">&ldquo;{recipe.marginNote}&rdquo;</p>
                <span className="micro">{recipe.ingredientCount} ingredients</span>
              </div>
            )}
            <p className="micro">
              {COURSE_LABEL[recipe.course]} · {recipe.kitchenName} · {formatMinutes(recipe.minutes)}
            </p>
            <h3 className="mt-1 font-serif text-[23px] font-normal leading-tight">{recipe.title}</h3>
            <p className="mt-1 font-serif text-[15px] italic text-inksoft">Handed down by {recipe.handedDownBy}</p>
            <div className="mt-4 flex items-center justify-between border-t border-rule pt-3">
              <span className="micro">{recipe.favourite ? "Pinned favourite" : "In the book"}</span>
              <span className="micro">Made {recipe.cookedCount}×</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
