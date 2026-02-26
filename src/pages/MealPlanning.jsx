import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Search, Sparkles, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addGroceryItemsFromMealPlan,
  createMealPlan,
  createRecipe,
  createRecipeFromParsed,
  deleteMealPlan,
  deleteRecipe,
  generateShoppingListFromMealPlans,
  getRecipes,
  getWeeklyMealPlan,
  markMealAsPrepared,
  searchRecipes,
  toggleRecipeFavorite,
  updateRecipe,
} from '../services';
import AppHeader from '../components/layout/AppHeader';
import ParseRecipeModal from '../components/meal-planning/ParseRecipeModal';
import { Badge, Button, Card, Input, Modal, PageContainer, SectionHeader, Select, Textarea } from '../components/ui';

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_PLAN_DATE_KEY = 'mealPlanLastDate';

function toYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getQuickSelectDates() {
  const today = new Date();
  const todayStr = toYYYYMMDD(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const plus3 = new Date(today);
  plus3.setDate(plus3.getDate() + 3);
  const plus7 = new Date(today);
  plus7.setDate(plus7.getDate() + 7);
  const dayOfWeek = today.getDay();
  let sat = new Date(today);
  sat.setDate(sat.getDate() + ((6 - dayOfWeek + 7) % 7));
  let sun = new Date(today);
  sun.setDate(sun.getDate() + ((7 - dayOfWeek) % 7));
  return { today: todayStr, tomorrow: toYYYYMMDD(tomorrow), plus3: toYYYYMMDD(plus3), plus7: toYYYYMMDD(plus7), saturday: toYYYYMMDD(sat), sunday: toYYYYMMDD(sun) };
}

const MealPlanning = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('recipes');
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showParseModal, setShowParseModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [groceryMessage, setGroceryMessage] = useState('');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recipeData, planData] = await Promise.all([getRecipes(), getWeeklyMealPlan()]);
      setRecipes(recipeData);
      setMealPlans(planData);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load meal planning data.');
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async () => {
    if (!searchTerm.trim()) return loadData();
    const searchResults = await searchRecipes(searchTerm);
    setRecipes(searchResults);
  };

  const onGenerateGrocery = async () => {
    setGroceryMessage('');
    setError('');
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 7);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const required = await generateShoppingListFromMealPlans(startStr, endStr);
      if (required.length === 0) {
        setGroceryMessage('No meals planned for the next 7 days. Add recipes to your meal plan first.');
        return;
      }
      const added = await addGroceryItemsFromMealPlan(required);
      if (added.length > 0) {
        setGroceryMessage(`Added ${added.length} item(s) to your grocery list (excluding items you already have in inventory or on your list).`);
      } else {
        setGroceryMessage('All meal plan ingredients are already in your grocery list or inventory. Nothing to add.');
      }
      loadData();
    } catch (err) {
      setGroceryMessage('');
      setError(err.message || 'Failed to generate grocery list.');
    }
  };

  if (loading) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      <AppHeader title="Meal Planning" subtitle="Recipes and weekly plan" onLogout={() => { logout(); navigate('/login'); }} backTo="/dashboard" />
      <PageContainer>
        <SectionHeader
          title="Meal Operations"
          subtitle="Plan meals and generate groceries from planned dishes."
          actions={
            <div className="flex gap-2">
              <Button variant={activeTab === 'recipes' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('recipes')}>Recipes</Button>
              <Button variant={activeTab === 'plan' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('plan')}>Meal Plan</Button>
              <Button variant={activeTab === 'grocery' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('grocery')}>Groceries</Button>
            </div>
          }
        />
        {error ? <Card className="mb-4 border-rose-900 bg-rose-900/20 text-rose-300">{error}</Card> : null}

        {activeTab === 'recipes' && (
          <div className="space-y-6">
            <Card className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search recipes"
              />
              <Button variant="secondary" onClick={onSearch}><Search className="h-4 w-4" />Search</Button>
              <Button variant="secondary" onClick={() => setShowRecipeModal(true)}><Plus className="h-4 w-4" />Add Recipe</Button>
              <Button onClick={() => setShowParseModal(true)}><Sparkles className="h-4 w-4" />Add Recipe with AI</Button>
            </Card>

            <div className="app-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {recipes.map((recipe) => (
                <Card key={recipe.id} hover>
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3>{recipe.name}</h3>
                      <p className="app-muted text-xs">{recipe.cooking_time} min · {recipe.difficulty_level}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = !(recipe.is_favorite === true);
                        setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: next } : r)));
                        toggleRecipeFavorite(recipe.id, next).then(loadData).catch(() => loadData());
                      }}
                    >
                      <Star className={`h-4 w-4 ${recipe.is_favorite === true ? 'text-amber-300 fill-amber-300' : 'text-app-text-muted'}`} />
                    </Button>
                  </div>
                  <p className="app-muted mb-4 line-clamp-2">{recipe.instructions || 'No instructions available.'}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setSelectedRecipe(recipe)}
                    >
                      Add to Plan
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingRecipe(recipe)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteRecipe(recipe.id).then(loadData)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <Card>
            <h3 className="mb-4">This Week</h3>
            <div className="space-y-3">
              {mealPlans.length === 0 ? <p className="app-muted">No planned meals.</p> : mealPlans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                  <div>
                    <p className="text-sm">{plan.recipe_name}</p>
                    <p className="text-xs app-muted">{plan.planned_date} · {plan.meal_type}</p>
                  </div>
                  <div className="flex gap-2">
                    {!plan.is_prepared ? (
                      <Button size="sm" variant="secondary" onClick={() => markMealAsPrepared(plan.id).then(loadData)}>Prepared</Button>
                    ) : <Badge tone="success">Prepared</Badge>}
                    <Button size="sm" variant="danger" onClick={() => deleteMealPlan(plan.id).then(loadData)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'grocery' && (
          <Card>
            <h3 className="mb-2">Generate Grocery List</h3>
            <p className="app-muted mb-4">Creates grocery items from your next 7 days of meal plans. Only items you don’t already have in inventory or on your grocery list are added.</p>
            <Button onClick={onGenerateGrocery}>Generate Grocery List</Button>
            {groceryMessage ? (
              <p className={`mt-4 text-sm ${groceryMessage.startsWith('Added') ? 'text-emerald-400' : 'app-muted'}`}>{groceryMessage}</p>
            ) : null}
          </Card>
        )}
      </PageContainer>

      <Modal open={showRecipeModal} onClose={() => setShowRecipeModal(false)} title="Create Recipe" maxWidth="max-w-2xl">
        <RecipeForm
          onSubmit={async (payload) => {
            await createRecipe(payload);
            setShowRecipeModal(false);
            loadData();
          }}
        />
      </Modal>

      <ParseRecipeModal
        open={showParseModal}
        onClose={() => setShowParseModal(false)}
        onSave={async (payload) => {
          await createRecipeFromParsed(payload);
          loadData();
        }}
      />

      <Modal open={!!selectedRecipe} onClose={() => setSelectedRecipe(null)} title="Add to meal plan">
        {selectedRecipe ? (
          <MealPlanForm
            recipe={selectedRecipe}
            prefilledDate={null}
            onSubmit={async (payload) => {
              await createMealPlan(payload);
              setSelectedRecipe(null);
              loadData();
            }}
          />
        ) : null}
      </Modal>

      <Modal open={!!editingRecipe} onClose={() => setEditingRecipe(null)} title="Edit Recipe" maxWidth="max-w-2xl">
        {editingRecipe ? (
          <RecipeForm
            initialRecipe={editingRecipe}
            onSubmit={async (payload) => {
              await updateRecipe(editingRecipe.id, payload);
              setEditingRecipe(null);
              loadData();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
};

const RecipeForm = ({ initialRecipe, onSubmit }) => {
  const [ingredients, setIngredients] = useState(
    Array.isArray(initialRecipe?.ingredients) ? initialRecipe.ingredients.join(', ') : (initialRecipe?.ingredients || '')
  );
  const [cookingTime, setCookingTime] = useState(
    initialRecipe != null && initialRecipe.cooking_time != null ? String(initialRecipe.cooking_time) : ''
  );
  const [servings, setServings] = useState(
    initialRecipe != null && initialRecipe.servings != null ? String(initialRecipe.servings) : '1'
  );
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const payload = {
          name: formData.get('name'),
          cuisine: formData.get('cuisine'),
          cookingTime: Number(cookingTime) || 0,
          servings: Number(servings) || 1,
          difficulty: formData.get('difficulty'),
          category: formData.get('category'),
          instructions: formData.get('instructions'),
          ingredients: ingredients.split(',').map((item) => item.trim()).filter(Boolean),
        };
        if (initialRecipe) {
          payload.recipeUrl = initialRecipe.recipe_url;
          payload.calories = initialRecipe.calories_per_serving;
        }
        onSubmit(payload);
      }}
    >
      <Input name="name" placeholder="Recipe name" required className="md:col-span-2" defaultValue={initialRecipe?.name} />
      <Input name="cuisine" placeholder="Cuisine" defaultValue={initialRecipe?.cuisine} />
      <Input
        name="cookingTime"
        type="number"
        min={0}
        placeholder="Cooking time (min)"
        required
        value={cookingTime}
        onChange={(e) => setCookingTime(e.target.value)}
      />
      <Input
        name="servings"
        type="number"
        min={1}
        placeholder="Servings"
        required
        value={servings}
        onChange={(e) => setServings(e.target.value)}
      />
      <Select name="difficulty" required defaultValue={initialRecipe?.difficulty_level}>
        <option value="easy">easy</option>
        <option value="medium">medium</option>
        <option value="hard">hard</option>
      </Select>
      <Select name="category" required defaultValue={initialRecipe?.category}>
        <option value="breakfast">breakfast</option>
        <option value="lunch">lunch</option>
        <option value="dinner">dinner</option>
        <option value="snack">snack</option>
      </Select>
      <Input
        value={ingredients}
        onChange={(event) => setIngredients(event.target.value)}
        placeholder="Ingredients (comma separated)"
        className="md:col-span-2"
      />
      <Textarea name="instructions" rows={4} placeholder="Instructions" className="md:col-span-2" defaultValue={initialRecipe?.instructions} />
      <Button type="submit" className="md:col-span-2">{initialRecipe ? 'Update Recipe' : 'Save Recipe'}</Button>
    </form>
  );
};

const MealPlanForm = ({ recipe, prefilledDate, onSubmit }) => {
  const quickDates = getQuickSelectDates();
  const defaultDate = prefilledDate
    || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(MEAL_PLAN_DATE_KEY) : null)
    || quickDates.today;
  const [date, setDate] = useState(defaultDate);

  const setDateAndStore = (value) => {
    setDate(value);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(MEAL_PLAN_DATE_KEY, value);
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(MEAL_PLAN_DATE_KEY, date);
        onSubmit({
          recipeId: recipe.id,
          date,
          mealType: formData.get('mealType'),
          servings: Number(formData.get('servings')),
          notes: formData.get('notes'),
        });
      }}
    >
      <Card className="bg-app-bg-primary">
        <h3>{recipe.name}</h3>
        <p className="app-muted text-xs">{recipe.cooking_time} min · {recipe.servings} servings</p>
      </Card>

      <div>
        <p className="app-muted text-xs mb-1.5">Quick select</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {[
            { label: 'Today', value: quickDates.today },
            { label: 'Tomorrow', value: quickDates.tomorrow },
            { label: '+3 Days', value: quickDates.plus3 },
            { label: '+7 Days', value: quickDates.plus7 },
            { label: 'This Saturday', value: quickDates.saturday },
            { label: 'This Sunday', value: quickDates.sunday },
          ].map(({ label, value }) => (
            <Button
              key={label}
              type="button"
              variant={date === value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setDateAndStore(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="block text-sm font-medium text-app-text-secondary mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDateAndStore(e.target.value)}
          onKeyDown={(e) => e.preventDefault()}
          required
          className="w-full rounded-ui border border-app-border bg-app-bg-primary px-3 py-2 text-app-text-primary focus:border-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent"
        />
        <input type="hidden" name="date" value={date} />
      </div>

      <Select name="mealType" required>
        {mealTypes.map((mealType) => <option key={mealType} value={mealType}>{mealType}</option>)}
      </Select>
      <Input type="number" name="servings" defaultValue={recipe.servings || 1} required />
      <Textarea name="notes" rows={2} placeholder="Notes" />
      <Button type="submit" className="w-full">Add to Plan</Button>
    </form>
  );
};

export default MealPlanning;