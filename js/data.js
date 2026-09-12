/* ---------------------------------------------------------------------------
   data.js — grunddata och lagring för Veckomenyn
   Här ligger allt som inte är Vue: startrecepten, veckodagarna, enheterna,
   veckonummerberäkningen och funktionerna som pratar med localStorage.
--------------------------------------------------------------------------- */

/* Veckodagarna. key används internt i planobjektet, label är det som visas.
   Nyckeln hålls fri från å, ä och ö så att den aldrig blir beroende av att
   filen tolkas som UTF-8 — användaren ser bara label. */
const WEEKDAYS = [
  { key: 'mandag', label: 'Måndag' },
  { key: 'tisdag', label: 'Tisdag' },
  { key: 'onsdag', label: 'Onsdag' },
  { key: 'torsdag', label: 'Torsdag' },
  { key: 'fredag', label: 'Fredag' },
  { key: 'lordag', label: 'Lördag' },
  { key: 'sondag', label: 'Söndag' }
];

/* De tre måltiderna varje dag har. code är den korta etiketten i måltidsraden. */
const MEALS = [
  { key: 'frukost', label: 'Frukost', code: 'Fru' },
  { key: 'lunch', label: 'Lunch', code: 'Lun' },
  { key: 'middag', label: 'Middag', code: 'Mid' }
];

/* Fasta måttenheter. En fast lista gör att inköpslistan kan slå ihop rader:
   "g" stavas alltid "g" och blir aldrig "gram" på en annan rad. */
const UNITS = ['g', 'kg', 'dl', 'ml', 'msk', 'tsk', 'st'];

/* Enheter som räknas i hela tal i inköpslistan. Övriga visas med en decimal. */
const WHOLE_NUMBER_UNITS = ['g', 'ml'];

/* Startrecepten. Mängderna är lagrade PER PORTION, precis som recepten
   användaren själv lägger till: formuläret dividerar med antalet portioner
   innan receptet sparas. Inköpslistan multiplicerar sedan upp igen. */
const SEED_RECIPES = [
  {
    id: 1,
    name: 'Havregrynsgröt',
    category: 'frukost',
    ingredients: [
      { name: 'Havregryn', amount: 80, unit: 'g' },
      { name: 'Mjölk', amount: 1, unit: 'dl' },
      { name: 'Salt', amount: 1, unit: 'tsk' }
    ]
  },
  {
    id: 2,
    name: 'Fil & müsli',
    category: 'frukost',
    ingredients: [
      { name: 'Filmjölk', amount: 2, unit: 'dl' },
      { name: 'Müsli', amount: 60, unit: 'g' },
      { name: 'Blåbär', amount: 40, unit: 'g' }
    ]
  },
  {
    id: 3,
    name: 'Äggröra & bröd',
    category: 'frukost',
    ingredients: [
      { name: 'Ägg', amount: 2, unit: 'st' },
      { name: 'Smör', amount: 10, unit: 'g' },
      { name: 'Bröd', amount: 2, unit: 'st' }
    ]
  },
  {
    id: 4,
    name: 'Svampsoppa',
    category: 'lunch',
    ingredients: [
      { name: 'Champinjoner', amount: 150, unit: 'g' },
      { name: 'Grädde', amount: 1, unit: 'dl' },
      { name: 'Gul lök', amount: 0.5, unit: 'st' },
      { name: 'Buljongtärning', amount: 1, unit: 'st' }
    ]
  },
  {
    id: 5,
    name: 'Chiapudding',
    category: 'lunch',
    ingredients: [
      { name: 'Chiafrön', amount: 30, unit: 'g' },
      { name: 'Kokosmjölk', amount: 1.5, unit: 'dl' },
      { name: 'Honung', amount: 1, unit: 'msk' }
    ]
  },
  {
    id: 6,
    name: 'Tonfisksallad',
    category: 'lunch',
    ingredients: [
      { name: 'Tonfisk', amount: 80, unit: 'g' },
      { name: 'Majs', amount: 50, unit: 'g' },
      { name: 'Sallad', amount: 40, unit: 'g' },
      { name: 'Majonnäs', amount: 1, unit: 'msk' }
    ]
  },
  {
    id: 7,
    name: 'Pasta carbonara',
    category: 'middag',
    ingredients: [
      { name: 'Pasta', amount: 80, unit: 'g' },
      { name: 'Ägg', amount: 0.5, unit: 'st' },
      { name: 'Bacon', amount: 60, unit: 'g' },
      { name: 'Parmesan', amount: 20, unit: 'g' }
    ]
  },
  {
    id: 8,
    name: 'Korvstroganoff',
    category: 'middag',
    ingredients: [
      { name: 'Falukorv', amount: 125, unit: 'g' },
      { name: 'Krossade tomater', amount: 100, unit: 'g' },
      { name: 'Grädde', amount: 0.5, unit: 'dl' },
      { name: 'Ris', amount: 75, unit: 'g' },
      { name: 'Gul lök', amount: 0.25, unit: 'st' }
    ]
  },
  {
    id: 9,
    name: 'Shakshuka',
    category: 'middag',
    ingredients: [
      { name: 'Krossade tomater', amount: 200, unit: 'g' },
      { name: 'Ägg', amount: 2, unit: 'st' },
      { name: 'Paprika', amount: 0.5, unit: 'st' },
      { name: 'Gul lök', amount: 0.5, unit: 'st' },
      { name: 'Spiskummin', amount: 1, unit: 'tsk' }
    ]
  }
];

/* ---------------------------------------------------------------------------
   Veckonummer
--------------------------------------------------------------------------- */

/* Räknar ut ISO-veckonummer. Regeln är att veckan tillhör det år som dess
   torsdag ligger i, så vi flyttar datumet till torsdagen i samma vecka och
   jämför med årets första torsdag. */
function getIsoWeek(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // getDay() ger söndag = 0. Vi vill ha måndag = 0.
  const dayNumber = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);

  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return 1 + Math.round((target - firstThursday) / msPerWeek);
}

/* Veckonumren i väljaren: 1 till 52. */
function buildWeekNumbers() {
  const weeks = [];

  for (let week = 1; week <= 52; week++) {
    weeks.push(week);
  }

  return weeks;
}

/* ---------------------------------------------------------------------------
   Planen
--------------------------------------------------------------------------- */

/* Bygger en tom plan: sju dagar som var och en har tre måltidsplatser.
   En tom plats har recipeId null och portions 2. */
function createEmptyPlan() {
  const plan = {};

  WEEKDAYS.forEach(function (day) {
    plan[day.key] = {};

    MEALS.forEach(function (meal) {
      plan[day.key][meal.key] = { recipeId: null, portions: 2 };
    });
  });

  return plan;
}

/* ---------------------------------------------------------------------------
   localStorage
   Lagringen kan kasta fel i privat surfläge, och värdet som ligger där kan
   vara trasigt om något annat har skrivit till nyckeln. Därför är varje
   läsning och skrivning inpackad i try/catch och läsningen returnerar
   reservvärdet i stället för att krascha appen.
--------------------------------------------------------------------------- */

const STORAGE_KEYS = {
  user: 'veckomenyn.user',
  recipes: 'veckomenyn.recipes',
  plan: 'veckomenyn.plan',
  week: 'veckomenyn.week',
  bought: 'veckomenyn.bought'
};

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.warn('Kunde inte läsa ' + key + ' från localStorage.', error);
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Kunde inte spara ' + key + ' till localStorage.', error);
  }
}

function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Kunde inte ta bort ' + key + ' från localStorage.', error);
  }
}
