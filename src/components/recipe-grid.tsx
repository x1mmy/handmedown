"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { FoldedCorner, tween } from "@/components/motion";
import { COURSE_LABEL, formatMinutes } from "@/lib/format";
import type { RecipeCard } from "@/lib/types";

export function RecipeGrid({ bookId, recipes }: { bookId: string; recipes: RecipeCard[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-1 border-l border-rule desk:grid-cols-3">
      {recipes.map((recipe, index) => (
        <motion.div
          key={recipe.id}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { ...tween(0.28), delay: Math.min(index, 8) * 0.045 }}
        >
          <Link
            href={`/books/${bookId}/recipes/${recipe.id}`}
            className="press relative flex h-full flex-col justify-between border-b border-r border-rule p-5 hover:bg-sheet/70"
          >
            <FoldedCorner show={recipe.favourite} />
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
        </motion.div>
      ))}
    </div>
  );
}
