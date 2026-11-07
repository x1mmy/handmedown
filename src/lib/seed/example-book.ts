import type { Course, Ingredient } from "@/lib/types";

export const EXAMPLE_BOOK_ID = "10000000-0000-4000-8000-000000000001";
export const KITCHEN_NAN = "10000000-0000-4000-8000-000000000011";
export const KITCHEN_SAM = "10000000-0000-4000-8000-000000000012";
export const KITCHEN_COOP = "10000000-0000-4000-8000-000000000013";

export const USER_PREVIEW = "10000000-0000-4000-8000-0000000000a0";
export const USER_NAN = "10000000-0000-4000-8000-0000000000a1";
export const USER_SAM = "10000000-0000-4000-8000-0000000000a2";
export const USER_TOM = "10000000-0000-4000-8000-0000000000a3";
export const USER_LEILA = "10000000-0000-4000-8000-0000000000a4";
export const USER_OUTSIDER = "10000000-0000-4000-8000-0000000000a5";

export const RECIPE_SALMON = "10000000-0000-4000-8000-000000000101";
export const RECIPE_TART = "10000000-0000-4000-8000-000000000102";
export const RECIPE_KHEER = "10000000-0000-4000-8000-000000000103";
export const RECIPE_BREAD = "10000000-0000-4000-8000-000000000104";
export const RECIPE_PILAF = "10000000-0000-4000-8000-000000000105";
export const RECIPE_ROAST = "10000000-0000-4000-8000-000000000106";
export const RECIPE_RAITA = "10000000-0000-4000-8000-000000000107";

export const MEDIA_TABLE = "10000000-0000-4000-8000-000000000201";
export const MEDIA_TART = "10000000-0000-4000-8000-000000000202";
export const MEDIA_BREAD = "10000000-0000-4000-8000-000000000203";
export const MEDIA_PILAF = "10000000-0000-4000-8000-000000000204";
export const MEDIA_ROAST = "10000000-0000-4000-8000-000000000205";
export const MEDIA_TABLE_SET = "10000000-0000-4000-8000-000000000206";

export const ALBUM_SUNDAY = "10000000-0000-4000-8000-000000000301";
export const ALBUM_EID = "10000000-0000-4000-8000-000000000302";
export const ALBUM_BAKES = "10000000-0000-4000-8000-000000000303";

const T0 = Date.UTC(2026, 0, 4);

export type SeedUser = { id: string; email: string; name: string };
export type SeedBook = {
  id: string;
  title: string;
  ownerId: string;
  draftKey: string | null;
  isExample: boolean;
  createdAt: number;
};
export type SeedRecipe = {
  id: string;
  bookId: string;
  kitchenId: string;
  title: string;
  handedDownBy: string;
  recipeBy: string;
  course: Course;
  minutes: number;
  servings: number;
  marginNote: string;
  steps: string[];
  ingredients: Ingredient[];
  version: number;
  deletedAt: number | null;
  cookedCount: number;
  heroMediaId: string | null;
  createdBy: string;
  updatedAt: number;
};

function ing(numerator: number, denominator: number, unit: string, item: string, original: string): Ingredient {
  return { numerator, denominator, unit, item, original_text: original };
}

export const SEED_USERS: SeedUser[] = [
  { id: USER_PREVIEW, email: "household@handmedown.local", name: "Example household" },
  { id: USER_NAN, email: "nan@handmedown.local", name: "Nan" },
  { id: USER_SAM, email: "sam@handmedown.local", name: "Sam" },
  { id: USER_TOM, email: "tom@handmedown.local", name: "Tom" },
  { id: USER_LEILA, email: "leila@handmedown.local", name: "Leila" },
  { id: USER_OUTSIDER, email: "outsider@handmedown.local", name: "Outsider" },
];

export const SEED_BOOK: SeedBook = {
  id: EXAMPLE_BOOK_ID,
  title: "The Fam",
  ownerId: USER_PREVIEW,
  draftKey: null,
  isExample: true,
  createdAt: T0,
};

export const SEED_RECIPES: SeedRecipe[] = [
  {
    id: RECIPE_SALMON,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId: KITCHEN_NAN,
    title: "Friday Pan-Seared Salmon & Herbed Couscous",
    handedDownBy: "Nan",
    recipeBy: "Nani",
    course: "mains",
    minutes: 35,
    servings: 4,
    marginNote:
      "Dry the skin with paper towel and don't touch the pan for the first four minutes. Always extra lemon at the table.",
    cookedCount: 34,
    heroMediaId: MEDIA_TABLE,
    version: 1,
    deletedAt: null,
    createdBy: USER_NAN,
    updatedAt: T0,
    ingredients: [
      ing(5, 4, "cups", "pearl couscous", "1 1/4 cups pearl couscous"),
      ing(4, 1, "fillets", "skin-on salmon", "4 fillets skin-on salmon"),
      ing(3, 2, "tbsp", "extra-virgin olive oil", "1 1/2 tbsp extra-virgin olive oil"),
      ing(1, 2, "cup", "fresh basil and pine nut pesto", "1/2 cup fresh basil and pine nut pesto"),
      ing(3, 4, "tsp", "flaky sea salt", "3/4 tsp flaky sea salt"),
      ing(2, 1, "", "lemons, for the table", "2 lemons, for the table"),
    ],
    steps: [
      "Simmer the pearl couscous in salted water for 9 minutes until tender, drain, and fold through chopped herbs and lemon zest.",
      "Set a heavy skillet over medium-high heat with olive oil. Lay salmon skin-side down and sear untouched for 4 minutes until crisp and golden.",
      "Flip, spoon over the pesto, and cook 2 minutes more. Rest off the heat, then serve over the couscous with extra lemon.",
    ],
  },
  {
    id: RECIPE_TART,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId: KITCHEN_SAM,
    title: "Torched Meyer Lemon Meringue Tart",
    handedDownBy: "Auntie Claire",
    recipeBy: "Auntie Claire",
    course: "sweets",
    minutes: 50,
    servings: 8,
    marginNote: "The curd can be made the day before. Torch the meringue once everyone is already at the table.",
    cookedCount: 19,
    heroMediaId: MEDIA_TART,
    version: 1,
    deletedAt: null,
    createdBy: USER_SAM,
    updatedAt: T0,
    ingredients: [
      ing(3, 2, "cups", "plain flour", "1 1/2 cups plain flour"),
      ing(3, 4, "cup", "cold butter", "3/4 cup cold butter"),
      ing(1, 3, "cup", "caster sugar", "1/3 cup caster sugar"),
      ing(4, 1, "eggs", "separated", "4 eggs, separated"),
      ing(2, 1, "", "Meyer lemons, juice and zest", "2 Meyer lemons, juice and zest"),
    ],
    steps: [
      "Rub the butter into the flour and sugar until it looks like breadcrumbs, then bring the pastry together and chill.",
      "Blind-bake the shell until the edges are the colour of tea. Cool before the curd goes in.",
      "Cook lemon juice, zest, yolks and sugar over gentle heat until the curd coats a spoon. Fill the shell.",
      "Whip the whites to firm peaks with the remaining sugar, pile onto the curd, and torch until the ridges colour.",
    ],
  },
  {
    id: RECIPE_KHEER,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId: KITCHEN_NAN,
    title: "Slow-Simmered Cardamom Kheer",
    handedDownBy: "Dadi",
    recipeBy: "Dadi",
    course: "sweets",
    minutes: 45,
    servings: 6,
    marginNote: "Crush green cardamom pods fresh in the mortar — never pre-ground.",
    cookedCount: 27,
    heroMediaId: null,
    version: 1,
    deletedAt: null,
    createdBy: USER_NAN,
    updatedAt: T0,
    ingredients: [
      ing(1, 1, "l", "whole milk", "1 l whole milk"),
      ing(1, 2, "cup", "basmati rice", "1/2 cup basmati rice"),
      ing(6, 1, "cloves", "green cardamom pods", "6 cloves green cardamom pods"),
      ing(1, 3, "cup", "sugar", "1/3 cup sugar"),
      ing(2, 1, "tbsp", "chopped pistachios", "2 tbsp chopped pistachios"),
    ],
    steps: [
      "Rinse the rice until the water runs almost clear, then soak it while the milk warms.",
      "Simmer the milk with the bruised cardamom, stirring so it does not catch, until it smells sweet.",
      "Add the rice and cook slowly until the grains bloom and the milk thickens. Stir in sugar off the boil.",
      "Chill, then scatter pistachios. It should still be spoonable, not set like a custard.",
    ],
  },
  {
    id: RECIPE_BREAD,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId: KITCHEN_COOP,
    title: "Sunday Seeded Country Sourdough",
    handedDownBy: "Uncle Tom",
    recipeBy: "Uncle Tom",
    course: "bakes",
    minutes: 240,
    servings: 8,
    marginNote: "If the dough feels slack, trust the folds. Do not add flour on the bench.",
    cookedCount: 41,
    heroMediaId: MEDIA_BREAD,
    version: 1,
    deletedAt: null,
    createdBy: USER_TOM,
    updatedAt: T0,
    ingredients: [
      ing(500, 1, "g", "bread flour", "500 g bread flour"),
      ing(350, 1, "g", "water", "350 g water"),
      ing(100, 1, "g", "ripe starter", "100 g ripe starter"),
      ing(10, 1, "g", "fine salt", "10 g fine salt"),
      ing(40, 1, "g", "mixed seeds", "40 g mixed seeds"),
    ],
    steps: [
      "Mix flour and water and leave it covered for 30 minutes before the salt and starter go in.",
      "Fold the dough four times across the first two hours. It should feel alive, not tight.",
      "Shape, roll the top in seeds, and prove in the fridge overnight.",
      "Bake covered in a hot pot, then uncovered until the crust is the colour of a walnut.",
    ],
  },
  {
    id: RECIPE_PILAF,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId: KITCHEN_NAN,
    title: "Eid Chicken Pilaf",
    handedDownBy: "Nan",
    recipeBy: "Nani",
    course: "mains",
    minutes: 70,
    servings: 8,
    marginNote: "Rinse the rice until it runs clear, then let it steam off the heat with a tea towel under the lid.",
    cookedCount: 16,
    heroMediaId: MEDIA_PILAF,
    version: 1,
    deletedAt: null,
    createdBy: USER_NAN,
    updatedAt: T0,
    ingredients: [
      ing(2, 1, "cups", "basmati rice", "2 cups basmati rice"),
      ing(700, 1, "g", "chicken thighs", "700 g chicken thighs"),
      ing(1, 1, "tsp", "cumin seeds", "1 tsp cumin seeds"),
      ing(4, 1, "cloves", "garlic", "4 cloves garlic"),
      ing(1, 2, "tsp", "ground turmeric", "1/2 tsp ground turmeric"),
    ],
    steps: [
      "Brown the chicken in a wide pot with the whole spices until the edges catch.",
      "Stir in garlic, turmeric and rice, then pour in just enough stock to cover a knuckle above the rice.",
      "Bring to a boil, cover, and cook on the lowest flame for 18 minutes.",
      "Rest ten minutes before fluffing. The bottom should have a thin golden crust.",
    ],
  },
  {
    id: RECIPE_ROAST,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId: KITCHEN_COOP,
    title: "Grilled Chicken with Creamed Greens",
    handedDownBy: "Uncle Tom",
    recipeBy: "Uncle Tom",
    course: "mains",
    minutes: 45,
    servings: 4,
    marginNote: "Salt the chicken an hour ahead. The grill marks are for colour, not for rushing.",
    cookedCount: 11,
    heroMediaId: MEDIA_ROAST,
    version: 1,
    deletedAt: null,
    createdBy: USER_TOM,
    updatedAt: T0,
    ingredients: [
      ing(4, 1, "fillets", "chicken breasts", "4 fillets chicken breasts"),
      ing(2, 1, "tbsp", "olive oil", "2 tbsp olive oil"),
      ing(1, 1, "tsp", "fine salt", "1 tsp fine salt"),
      ing(300, 1, "g", "mixed peas, corn and carrots", "300 g mixed peas, corn and carrots"),
      ing(200, 1, "ml", "cream", "200 ml cream"),
    ],
    steps: [
      "Heat a grill pan until a drop of water skitters. Oil the chicken, not the pan.",
      "Grill without moving for 4 minutes, turn, and finish until just cooked through.",
      "Simmer the vegetables in cream with a little of the chicken juices until glossy.",
      "Rest the chicken, slice, and lay it over the greens with a last pinch of salt.",
    ],
  },
  {
    id: RECIPE_RAITA,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId: KITCHEN_SAM,
    title: "Cucumber and Mint Raita",
    handedDownBy: "Leila",
    recipeBy: "Leila",
    course: "sides",
    minutes: 15,
    servings: 6,
    marginNote: "Salt the cucumber and leave it in a sieve. Watery raita means it was rushed.",
    cookedCount: 22,
    heroMediaId: null,
    version: 1,
    deletedAt: null,
    createdBy: USER_LEILA,
    updatedAt: T0,
    ingredients: [
      ing(2, 1, "cups", "plain yoghurt", "2 cups plain yoghurt"),
      ing(1, 1, "", "cucumber, grated", "1 cucumber, grated"),
      ing(1, 4, "cup", "mint leaves", "1/4 cup mint leaves"),
      ing(1, 2, "tsp", "cumin", "1/2 tsp cumin"),
      ing(1, 2, "tsp", "salt", "1/2 tsp salt"),
    ],
    steps: [
      "Salt the grated cucumber and leave it to drain for ten minutes. Squeeze it dry.",
      "Stir the cucumber, mint and cumin through the yoghurt.",
      "Taste for salt. It should be cold and thick enough to sit beside the pilaf.",
    ],
  },
];
