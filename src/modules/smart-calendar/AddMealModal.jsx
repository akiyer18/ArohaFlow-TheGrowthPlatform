import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../components/ui';
import { getRecipes } from '../../services';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function AddMealModal({ open, onClose, defaultDateKey, onSave }) {
  const [dateKey, setDateKey] = useState(defaultDateKey || '');
  const [mealType, setMealType] = useState('lunch');
  const [recipeId, setRecipeId] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDateKey(defaultDateKey || '');
      getRecipes().then(setRecipes).catch(() => setRecipes([]));
    }
  }, [open, defaultDateKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dateKey || !recipeId) return;
    setSaving(true);
    try {
      await onSave({
        recipeId,
        date: dateKey,
        mealType,
        servings: 1,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Add Meal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-app-text-muted mb-1">Date</label>
          <Input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-app-text-muted mb-1">Meal</label>
          <Select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs text-app-text-muted mb-1">Recipe</label>
          <Select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} required>
            <option value="">Select recipe</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !recipeId}>
            {saving ? 'Adding…' : 'Add to plan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
