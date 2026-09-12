/* ---------------------------------------------------------------------------
   app.js — Vue-applikationen
--------------------------------------------------------------------------- */

const { createApp } = Vue;

createApp({
  data() {
    return {
      /* Vem som är inloggad. Tomt betyder att grinden visas. */
      user: '',
      nameInput: '',
      loginError: '',

      /* Vilken vy som visas: 'plan' eller 'recept'. */
      view: 'plan',

      /* Veckan man planerar. Sätts till aktuell ISO-vecka i mounted(). */
      selectedWeek: 1,
      weekNumbers: buildWeekNumbers(),

      /* Listan appen bygger på. Recept läggs till och tas bort här. */
      recipes: [],
      nextRecipeId: 1,

      /* Veckoplanen: sju dagar med tre måltidsplatser var. */
      plan: createEmptyPlan(),

      /* Nycklarna för de rader i inköpslistan som är markerade som köpta. */
      bought: [],

      /* Formuläret för nytt recept. */
      newRecipe: {
        name: '',
        category: 'middag',
        portions: 4,
        ingredients: [{ name: '', amount: null, unit: 'g' }]
      },
      recipeError: '',
      recipeSaved: '',

      /* Konstanter från data.js, lyfta in i data() så templaten når dem. */
      weekdays: WEEKDAYS,
      meals: MEALS,
      units: UNITS
    };
  },

  computed: {
    /* Går igenom veckans alla 21 måltidsplatser, skalar upp varje recept
       till det antal portioner platsen är satt till och slår ihop lika
       ingredienser. Nyckeln är namn + enhet, så "Ägg st" och "Ägg g" blir
       två rader medan "ägg" och "Ägg" blir samma. */
    shoppingList() {
      const totals = {};

      this.weekdays.forEach((day) => {
        this.meals.forEach((meal) => {
          const slot = this.plan[day.key][meal.key];

          if (!slot.recipeId) {
            return;
          }

          const recipe = this.recipes.find((item) => item.id === slot.recipeId);

          // Receptet kan ha raderats efter att det planerades in.
          if (!recipe) {
            return;
          }

          recipe.ingredients.forEach((ingredient) => {
            const key = ingredient.name.trim().toLowerCase() + '|' + ingredient.unit;

            if (!totals[key]) {
              totals[key] = {
                key: key,
                name: ingredient.name.trim(),
                unit: ingredient.unit,
                amount: 0
              };
            }

            // Mängden är lagrad per portion, så den multipliceras upp här.
            totals[key].amount += ingredient.amount * slot.portions;
          });
        });
      });

      const rows = Object.keys(totals).map((key) => {
        const row = totals[key];
        row.display = this.formatAmount(row.amount, row.unit);
        return row;
      });

      // Bokstavsordning gör listan lättare att läsa i butiken.
      rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'));

      return rows;
    },

    /* Hur många rader som är markerade som inhandlade just nu. Styr om
       knappen "Rensa markeringar" ska finnas. */
    boughtCount() {
      return this.shoppingList.filter((item) => this.isBought(item.key)).length;
    },

    /* Receptet går att spara när det har ett namn och minst en ingrediens
       som är helt ifylld. Styr om spara-knappen renderas alls. */
    isRecipeValid() {
      if (this.newRecipe.name.trim() === '') {
        return false;
      }

      if (!this.newRecipe.portions || this.newRecipe.portions < 1) {
        return false;
      }

      return this.newRecipe.ingredients.some((ingredient) => {
        return ingredient.name.trim() !== '' && ingredient.amount > 0;
      });
    }
  },

  methods: {

    /* ----- Inloggning ------------------------------------------------- */

    login() {
      const name = this.nameInput.trim();

      if (name === '') {
        this.loginError = 'Skriv ditt namn för att fortsätta.';
        return;
      }

      this.user = name;
      this.nameInput = '';
      this.loginError = '';
      saveToStorage(STORAGE_KEYS.user, this.user);
    },

    logout() {
      this.user = '';
      this.view = 'plan';
      removeFromStorage(STORAGE_KEYS.user);
    },

    goTo(view) {
      this.view = view;
      this.recipeError = '';
      this.recipeSaved = '';
    },

    /* ----- Veckoplanen ------------------------------------------------ */

    /* Recepten som får väljas till en viss måltid. En frukost dyker aldrig
       upp i middagslistan. */
    recipesByCategory(category) {
      return this.recipes.filter((recipe) => recipe.category === category);
    },

    changePortions(dayKey, mealKey, step) {
      const slot = this.plan[dayKey][mealKey];
      const next = slot.portions + step;

      if (next < 1 || next > 12) {
        return;
      }

      slot.portions = next;
      this.savePlan();
    },

    mealCode(category) {
      const meal = this.meals.find((item) => item.key === category);
      return meal ? meal.code : '';
    },

    /* ----- Inköpslistan ----------------------------------------------- */

    /* g och ml räknas i hela gram och milliliter. Övriga enheter kan bli
       halva och visas därför med en decimal, utan onödig nolla på slutet. */
    formatAmount(amount, unit) {
      if (WHOLE_NUMBER_UNITS.indexOf(unit) !== -1) {
        return String(Math.round(amount));
      }

      const rounded = Math.round(amount * 10) / 10;
      return String(rounded);
    },

    isBought(key) {
      return this.bought.indexOf(key) !== -1;
    },

    /* Egen funktionalitet: markerar en rad som inhandlad. Klassen sätts med
       class binding i templaten, så utseendet ändras av det användaren gör. */
    toggleBought(key) {
      const index = this.bought.indexOf(key);

      if (index === -1) {
        this.bought.push(key);
      } else {
        this.bought.splice(index, 1);
      }

      saveToStorage(STORAGE_KEYS.bought, this.bought);
    },

    clearBought() {
      this.bought = [];
      saveToStorage(STORAGE_KEYS.bought, this.bought);
    },

    /* ----- Recepten --------------------------------------------------- */

    addIngredientRow() {
      this.newRecipe.ingredients.push({ name: '', amount: null, unit: 'g' });
    },

    removeIngredientRow(index) {
      this.newRecipe.ingredients.splice(index, 1);
    },

    /* Lägger till i listan. Mängderna divideras med antalet portioner så
       att receptet sparas per portion — då blir uppräkningen i
       inköpslistan en ren multiplikation. */
    addRecipe() {
      if (!this.isRecipeValid) {
        this.recipeError = 'Fyll i namn och minst en ingrediens med mängd.';
        return;
      }

      const portions = this.newRecipe.portions;

      const ingredients = this.newRecipe.ingredients
        .filter((ingredient) => ingredient.name.trim() !== '' && ingredient.amount > 0)
        .map((ingredient) => {
          return {
            name: ingredient.name.trim(),
            amount: ingredient.amount / portions,
            unit: ingredient.unit
          };
        });

      this.recipes.push({
        id: this.nextRecipeId++,
        name: this.newRecipe.name.trim(),
        category: this.newRecipe.category,
        ingredients: ingredients
      });

      this.recipeSaved = this.newRecipe.name.trim() + ' är sparat.';
      this.recipeError = '';

      this.newRecipe = {
        name: '',
        category: 'middag',
        portions: 4,
        ingredients: [{ name: '', amount: null, unit: 'g' }]
      };

      this.saveRecipes();

      if (this.$refs.recipeName) {
        this.$refs.recipeName.focus();
      }
    },

    /* Tar bort ur listan. Receptet plockas också bort från alla
       måltidsplatser där det var inplanerat, annars pekar planen på ett
       recept som inte finns. */
    deleteRecipe(id) {
      const index = this.recipes.findIndex((recipe) => recipe.id === id);

      if (index === -1) {
        return;
      }

      this.recipes.splice(index, 1);

      this.weekdays.forEach((day) => {
        this.meals.forEach((meal) => {
          if (this.plan[day.key][meal.key].recipeId === id) {
            this.plan[day.key][meal.key].recipeId = null;
          }
        });
      });

      this.recipeSaved = '';
      this.saveRecipes();
      this.savePlan();
    },

    /* ----- Lagring ---------------------------------------------------- */

    saveRecipes() {
      saveToStorage(STORAGE_KEYS.recipes, {
        items: this.recipes,
        nextId: this.nextRecipeId
      });
    },

    savePlan() {
      saveToStorage(STORAGE_KEYS.plan, this.plan);
    },

    saveWeek() {
      saveToStorage(STORAGE_KEYS.week, this.selectedWeek);
    }
  },

  /* Läser in det som sparats sedan förra besöket. Första gången finns
     ingenting, och då används startrecepten. */
  mounted() {
    this.selectedWeek = getIsoWeek(new Date());

    const savedUser = loadFromStorage(STORAGE_KEYS.user, '');

    if (typeof savedUser === 'string') {
      this.user = savedUser;
    }

    const savedRecipes = loadFromStorage(STORAGE_KEYS.recipes, null);

    if (savedRecipes && Array.isArray(savedRecipes.items)) {
      this.recipes = savedRecipes.items;
      this.nextRecipeId = savedRecipes.nextId || savedRecipes.items.length + 1;
    } else {
      this.recipes = SEED_RECIPES;
      this.nextRecipeId = SEED_RECIPES.length + 1;
      this.saveRecipes();
    }

    const savedPlan = loadFromStorage(STORAGE_KEYS.plan, null);

    if (savedPlan) {
      // Plocka ut plats för plats ur det sparade, så att en gammal eller
      // trasig plan aldrig kan lämna appen med dagar som saknas.
      this.weekdays.forEach((day) => {
        this.meals.forEach((meal) => {
          const saved = savedPlan[day.key] && savedPlan[day.key][meal.key];

          if (saved) {
            this.plan[day.key][meal.key] = {
              recipeId: saved.recipeId || null,
              portions: saved.portions || 2
            };
          }
        });
      });
    }

    const savedBought = loadFromStorage(STORAGE_KEYS.bought, []);

    if (Array.isArray(savedBought)) {
      this.bought = savedBought;
    }

    const savedWeek = loadFromStorage(STORAGE_KEYS.week, null);

    if (typeof savedWeek === 'number') {
      this.selectedWeek = savedWeek;
    }
  }
})
  .component('app-header', AppHeader)
  .component('app-footer', AppFooter)
  .mount('#app');
