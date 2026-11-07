"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { RiAddLine, RiCloseLine, RiFireFill, RiHeart3Fill } from "@remixicon/react";

import { Grouped, Row, Screen, ScreenHeader, Section, Thumb } from "@/components/app/screen";
import { TitleInput } from "@/components/book-controls";
import { ButtonLink } from "@/components/base/buttons/button";
import { SearchField } from "@/components/base/search-field/search-field";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { COURSE_LABEL, formatMinutes } from "@/lib/format";
import { COURSES, type Course, type RecipeCard } from "@/lib/types";
import { cx } from "@/utils/cx";

type HomeBook = { id: string; title: string; canEditTitle: boolean; recipeCount: number };

export function HomeScreen({
  book,
  recipes,
  results,
  query,
  kitchen,
}: {
  book: HomeBook;
  recipes: RecipeCard[];
  results: RecipeCard[] | null;
  query: string;
  kitchen: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [course, setCourse] = useState<Course | "all">("all");

  useEffect(() => setSearch(query), [query]);

  const favourites = useMemo(() => recipes.filter((recipe) => recipe.favourite), [recipes]);
  const cookAgain = useMemo(
    () => [...recipes].filter((recipe) => recipe.cookedCount > 0).sort((a, b) => b.cookedCount - a.cookedCount).slice(0, 8),
    [recipes],
  );
  const totalCooked = useMemo(() => recipes.reduce((sum, recipe) => sum + recipe.cookedCount, 0), [recipes]);
  const courses = useMemo(() => COURSES.filter((item) => recipes.some((recipe) => recipe.course === item)), [recipes]);
  const listed = useMemo(
    () => [...recipes].filter((recipe) => course === "all" || recipe.course === course).sort((a, b) => a.title.localeCompare(b.title)),
    [recipes, course],
  );

  function go(q: string) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (kitchen) params.set("kitchen", kitchen.id);
    const suffix = params.toString();
    router.push(suffix ? `/?${suffix}` : "/");
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={<Greeting />}
        title={book.canEditTitle ? <TitleInput bookId={book.id} title={book.title} /> : book.title}
        action={
          <ButtonLink href="/recipes/new" iconOnly leadingIcon={RiAddLine} aria-label="New recipe" className="size-11 rounded-full lg:hidden" />
        }
      />

      <div className="px-4 pt-3 lg:px-0">
        <SearchField
          aria-label="Search recipes"
          placeholder="Search dishes, ingredients, people"
          value={search}
          onChange={setSearch}
          onSubmit={(value) => go(value)}
          onClear={() => go("")}
          className="w-full lg:max-w-md"
          fieldClassName="h-11"
        />
      </div>

      {kitchen ? (
        <div className="px-4 pt-3 lg:px-0">
          <Link
            href={query ? `/?q=${encodeURIComponent(query)}` : "/"}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent-50 ps-3.5 pe-2.5 text-body-medium text-accent-700"
          >
            {kitchen.name}
            <RiCloseLine className="size-4" aria-label="Clear kitchen filter" />
          </Link>
        </div>
      ) : null}

      {results ? (
        <Section title={results.length ? `${results.length} ${results.length === 1 ? "match" : "matches"}` : undefined}>
          {results.length ? (
            <RecipeRows recipes={results} />
          ) : (
            <Empty title={`Nothing for “${query}”`} body="Try a dish, an ingredient or who taught it." />
          )}
        </Section>
      ) : book.recipeCount === 0 ? (
        <Empty
          className="mt-10"
          title="Your book is empty"
          body="Start with the dish everyone asks for."
          action={
            <ButtonLink href="/recipes/new" leadingIcon={RiAddLine} className="mt-5 h-11 rounded-full px-5 text-headline-semibold">
              Add the first recipe
            </ButtonLink>
          }
        />
      ) : (
        <>
          {totalCooked > 0 ? (
            <p className="flex items-center gap-1.5 px-4 pt-4 text-body-medium text-text-secondary lg:px-0">
              <RiFireFill className="size-4 text-accent-500" aria-hidden />
              {totalCooked} {totalCooked === 1 ? "meal" : "meals"} cooked from this book so far
            </p>
          ) : null}

          {favourites.length ? (
            <Section title="Family favourites">
              <Shelf>
                {favourites.map((recipe, index) => (
                  <ShelfCard key={recipe.id} recipe={recipe} index={index} size="large" />
                ))}
              </Shelf>
            </Section>
          ) : null}

          {cookAgain.length ? (
            <Section title="Cook again">
              <Shelf>
                {cookAgain.map((recipe, index) => (
                  <ShelfCard key={recipe.id} recipe={recipe} index={index} size="small" />
                ))}
              </Shelf>
            </Section>
          ) : null}

          <Section title="All recipes">
            {courses.length > 1 ? (
              <div className="shelf mb-3 overflow-x-auto px-4 lg:px-0">
                <SegmentedControl
                  aria-label="Course"
                  selectedKeys={[course]}
                  onSelectionChange={(keys) => {
                    const next = [...keys][0];
                    if (next) setCourse(next as Course | "all");
                  }}
                  className="min-w-max"
                >
                  <SegmentedControlItem id="all" className="px-3.5 py-1.5">All</SegmentedControlItem>
                  {courses.map((item) => (
                    <SegmentedControlItem key={item} id={item} className="px-3.5 py-1.5">
                      {COURSE_LABEL[item]}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </div>
            ) : null}
            <RecipeRows recipes={listed} />
          </Section>
        </>
      )}
    </Screen>
  );
}

function Greeting() {
  const [text, setText] = useState(" ");
  useEffect(() => {
    const hour = new Date().getHours();
    setText(hour < 5 ? "Late night snack?" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return <span suppressHydrationWarning>{text}</span>;
}

function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="shelf flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 lg:scroll-px-0 lg:px-0">{children}</div>
  );
}

function ShelfCard({ recipe, index, size }: { recipe: RecipeCard; index: number; size: "large" | "small" }) {
  const reduce = useReducedMotion();
  const large = size === "large";
  return (
    <motion.div
      className={cx("shrink-0 snap-start", large ? "w-[72%] max-w-72" : "w-36")}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.05, ease: [0.32, 0.72, 0, 1] }}
    >
      <Link href={`/recipes/${recipe.id}`} className="group block outline-none">
        <div className={cx("overflow-hidden rounded-3xl bg-background-tertiary-default", large ? "aspect-[4/5]" : "aspect-square")}>
          {recipe.heroUrl ? (
            <img
              src={recipe.heroUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] group-active:scale-[0.98]"
            />
          ) : (
            <div className="flex size-full items-center bg-accent-50 p-4">
              <p className={cx("font-hand text-accent-700", large ? "text-title-1-medium" : "text-title-3-medium")}>
                {recipe.marginNote || recipe.title}
              </p>
            </div>
          )}
        </div>
        <p className={cx("mt-2 line-clamp-2 text-text-primary", large ? "text-title-3-semibold" : "text-headline-semibold")}>{recipe.title}</p>
        <p className="mt-0.5 truncate text-body-regular text-text-secondary">
          {large ? `${recipe.kitchenName}, ${formatMinutes(recipe.minutes)}` : `Made ${recipe.cookedCount}×`}
        </p>
      </Link>
    </motion.div>
  );
}

function RecipeRows({ recipes }: { recipes: RecipeCard[] }) {
  return (
    <Grouped>
      {recipes.map((recipe) => (
        <Row
          key={recipe.id}
          href={`/recipes/${recipe.id}`}
          leading={<Thumb src={recipe.heroUrl} note={recipe.marginNote} />}
          title={recipe.title}
          subtitle={`${recipe.kitchenName}, ${formatMinutes(recipe.minutes)}`}
          trailing={recipe.favourite ? <RiHeart3Fill className="size-4 shrink-0 text-accent-500" aria-label="Favourite" /> : undefined}
        />
      ))}
    </Grouped>
  );
}

function Empty({ title, body, action, className }: { title: string; body: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("mx-4 rounded-3xl bg-background-primary-default px-6 py-12 text-center shadow-card lg:mx-0", className)}>
      <p className="text-title-3-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-body-regular text-text-secondary">{body}</p>
      {action}
    </div>
  );
}
