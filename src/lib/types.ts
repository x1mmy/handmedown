export const COURSES = ["mains", "sweets", "bakes", "sides"] as const;
export type Course = (typeof COURSES)[number];

export type Ingredient = {
  numerator: number;
  denominator: number;
  unit: string;
  item: string;
  original_text: string;
};

export type Principal = {
  userId: string | null;
  /** Anonymous visitor. On the example book this is the local sandbox household. */
  preview: boolean;
};

export type BookAccess = "owner" | "reader" | "guest";

export type BookSummary = {
  id: string;
  title: string;
  isExample: boolean;
  access: BookAccess;
  recipeCount: number;
  kitchenCount: number;
};

export type KitchenRef = { id: string; name: string };

export type BookDetail = BookSummary & {
  kitchens: KitchenRef[];
  myKitchenIds: string[];
  canEditTitle: boolean;
  canManageBook: boolean;
};

export type RecipeCard = {
  id: string;
  title: string;
  course: Course;
  minutes: number;
  servings: number;
  cookedCount: number;
  handedDownBy: string;
  kitchenId: string;
  kitchenName: string;
  favourite: boolean;
  heroUrl: string | null;
  marginNote: string;
  ingredientCount: number;
};

export type RecipeDetail = RecipeCard & {
  version: number;
  ingredients: Ingredient[];
  steps: string[];
  canEdit: boolean;
  deletedAt: number | null;
  bookId: string;
};

export type RecipeInput = {
  kitchenId: string;
  title: string;
  handedDownBy: string;
  course: Course;
  minutes: number;
  servings: number;
  marginNote: string;
  ingredients: Ingredient[];
  steps: string[];
};

export type RecipeFilters = {
  course?: Course | "all";
  kitchenId?: string;
  query?: string;
};

export type InviteView = {
  id: string;
  createdAt: number;
  revokedAt: number | null;
  redeemedAt: number | null;
  redeemedByName: string | null;
};

export type KitchenAdmin = {
  id: string;
  name: string;
  myRole: "lead" | "cook" | null;
  contentCount: number;
  members: { userId: string; name: string; role: "lead" | "cook" }[];
  pendingRequests: { id: string; userId: string; name: string }[];
};

export type KitchenDesk = {
  access: BookAccess;
  kitchens: KitchenAdmin[];
  invites: InviteView[];
};

export type AlbumPhoto = {
  id: string;
  mediaId: string;
  url: string;
  caption: string;
  meta: string;
  kitchenName: string | null;
};

export type AlbumView = {
  id: string;
  name: string;
  photos: AlbumPhoto[];
};

export const COVER_CLOTHS = [
  { id: "olive", name: "Olive Cloth", background: "#4B5544", color: "#FAF8F4" },
  { id: "oatmeal", name: "Oatmeal Linen", background: "#DFD8CB", color: "#171614" },
  { id: "oxblood", name: "Oxblood Buckram", background: "#6B2D24", color: "#FAF8F4" },
  { id: "navy", name: "Navy Bookcloth", background: "#232F3E", color: "#FAF8F4" },
] as const;

export type CoverId = (typeof COVER_CLOTHS)[number]["id"];

export type ExportSnapshot = {
  version: 1;
  bookId: string;
  title: string;
  subtitle: string;
  clothId: CoverId;
  bleed: boolean;
  capturedAt: string;
  recipes: Array<{
    id: string;
    title: string;
    course: string;
    kitchenName: string;
    handedDownBy: string;
    minutes: number;
    servings: number;
    marginNote: string;
    ingredients: string[];
    steps: string[];
  }>;
  albums: Array<{
    name: string;
    photos: { src: string; caption: string; meta: string }[];
  }>;
};

export function coverById(id: CoverId) {
  return COVER_CLOTHS.find((cloth) => cloth.id === id) ?? COVER_CLOTHS[0];
}
