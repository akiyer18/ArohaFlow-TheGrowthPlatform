import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { Modal, Button, Input, Textarea } from '../ui';
import { checkParseServerHealth, parseRecipeText } from '../../services/recipeParseService';
import { cn } from '../ui/cn';

export default function ParseRecipeModal({ open, onClose, onSave }) {
  const [step, setStep] = useState('paste');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState(null);
  const [serverStatus, setServerStatus] = useState(null); // { ok, configured } or null

  useEffect(() => {
    if (open) {
      setServerStatus(null);
      checkParseServerHealth().then(setServerStatus);
    }
  }, [open]);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setParseError('');
    try {
      const result = await parseRecipeText(rawText);
      setParsed(result);
      setStep('preview');
    } catch (err) {
      setParseError(err.message || 'Parsing failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('paste');
    setRawText('');
    setParsed(null);
    setParseError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add Recipe with AI" maxWidth="max-w-2xl">
      <AnimatePresence mode="wait">
        {step === 'paste' && (
          <motion.div
            key="paste"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {serverStatus && !serverStatus.ok && (
              <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-3 text-sm text-amber-200">
                <p className="font-medium">Parse server not running</p>
                <p className="mt-1">In a separate terminal run: <code className="rounded bg-black/30 px-1">npm run server</code></p>
                <p className="mt-1 text-xs text-amber-200/80">Then add OPENAI_API_KEY to your .env file (project root).</p>
              </div>
            )}
            {serverStatus?.ok && serverStatus.configured === false && (
              <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-3 text-sm text-amber-200">
                <p className="font-medium">API key not set</p>
                <p className="mt-1">Add <code className="rounded bg-black/30 px-1">OPENAI_API_KEY=sk-...</code> to .env in the project root, then restart the server (npm run server).</p>
              </div>
            )}
            <p className="text-sm text-app-text-muted">
              Paste recipe text from a blog, email, or document. Click Parse to extract title, ingredients, times, and instructions.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste recipe here..."
              className={cn(
                'w-full min-h-[200px] rounded-xl border border-app-border bg-app-bg-primary/80 px-4 py-3 text-sm text-app-text-primary placeholder:text-app-text-muted',
                'focus:border-app-accent focus:ring-2 focus:ring-app-accent/30 outline-none transition-ui'
              )}
              rows={10}
              disabled={loading}
            />
            {parseError && (
              <div className="rounded-lg border border-app-danger/50 bg-app-danger/10 p-3 text-sm text-app-danger">
                <p className="font-medium">Parsing failed</p>
                <p className="mt-1">{parseError}</p>
                <p className="mt-2 text-xs text-app-text-muted">
                  Ensure the parse server is running (npm run server) and OPENAI_API_KEY is set in .env
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleParse} disabled={loading || !rawText.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Parse Recipe
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
        {step === 'preview' && parsed && (
          <ParseRecipePreview
            key="preview"
            parsed={parsed}
            onBack={() => setStep('paste')}
            onSave={async (payload) => {
              await onSave(payload);
              handleClose();
            }}
          />
        )}
      </AnimatePresence>
    </Modal>
  );
}

function ParseRecipePreview({ parsed, onBack, onSave }) {
  const [edited, setEdited] = useState(() => ({
    title: parsed.title || '',
    description: parsed.description || '',
    prep_time_minutes: parsed.prep_time_minutes ?? '',
    cook_time_minutes: parsed.cook_time_minutes ?? '',
    total_time_minutes: parsed.total_time_minutes ?? '',
    servings: parsed.servings ?? '',
    ingredients: (parsed.ingredients || []).map((i) => ({
      name: i.name || '',
      quantity: i.quantity ?? '',
      unit: i.unit || '',
      optional: Boolean(i.optional),
    })),
    instructions: parsed.instructions || '',
  }));

  const requiredCount = edited.ingredients.filter((i) => !i.optional).length;
  const optionalCount = edited.ingredients.filter((i) => i.optional).length;

  const updateIngredient = (index, field, value) => {
    setEdited((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      title: edited.title.trim() || 'Untitled Recipe',
      description: edited.description.trim() || null,
      prep_time_minutes: edited.prep_time_minutes === '' ? null : Number(edited.prep_time_minutes),
      cook_time_minutes: edited.cook_time_minutes === '' ? null : Number(edited.cook_time_minutes),
      total_time_minutes: edited.total_time_minutes === '' ? null : Number(edited.total_time_minutes),
      servings: edited.servings === '' ? null : Number(edited.servings),
      ingredients: edited.ingredients.map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity === '' ? null : Number(i.quantity),
        unit: i.unit.trim() || null,
        optional: i.optional,
      })).filter((i) => i.name),
      instructions: edited.instructions.trim() || '',
    };
    if (!payload.total_time_minutes && (payload.prep_time_minutes || payload.cook_time_minutes)) {
      payload.total_time_minutes = (payload.prep_time_minutes || 0) + (payload.cook_time_minutes || 0);
    }
    onSave(payload);
  };

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-app-text-muted">Title</label>
          <Input
            value={edited.title}
            onChange={(e) => setEdited((p) => ({ ...p, title: e.target.value }))}
            placeholder="Recipe title"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-app-text-muted">Description (optional)</label>
          <Input
            value={edited.description}
            onChange={(e) => setEdited((p) => ({ ...p, description: e.target.value }))}
            placeholder="Short summary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-app-text-muted">Prep (min)</label>
          <Input
            type="number"
            min={0}
            value={edited.prep_time_minutes}
            onChange={(e) => setEdited((p) => ({ ...p, prep_time_minutes: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-app-text-muted">Cook (min)</label>
          <Input
            type="number"
            min={0}
            value={edited.cook_time_minutes}
            onChange={(e) => setEdited((p) => ({ ...p, cook_time_minutes: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-app-text-muted">Total (min)</label>
          <Input
            type="number"
            min={0}
            value={edited.total_time_minutes}
            onChange={(e) => setEdited((p) => ({ ...p, total_time_minutes: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-app-text-muted">Servings</label>
          <Input
            type="number"
            min={1}
            value={edited.servings}
            onChange={(e) => setEdited((p) => ({ ...p, servings: e.target.value }))}
            placeholder="1"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-app-text-muted">Ingredients</label>
          <span className="text-xs text-app-text-muted">
            {requiredCount} required {optionalCount > 0 && `· ${optionalCount} optional`}
          </span>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-app-border bg-app-bg-primary/60 p-3">
          {edited.ingredients.map((ing, index) => (
            <div
              key={index}
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5',
                ing.optional ? 'border-amber-800/50 bg-amber-900/20' : 'border-app-border'
              )}
            >
              <input
                type="number"
                min={0}
                step="any"
                className="w-16 rounded border border-app-border bg-app-bg-primary px-2 py-1 text-sm"
                placeholder="Qty"
                value={ing.quantity}
                onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
              />
              <input
                type="text"
                className="w-20 rounded border border-app-border bg-app-bg-primary px-2 py-1 text-sm"
                placeholder="Unit"
                value={ing.unit}
                onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
              />
              <input
                type="text"
                className="min-w-0 flex-1 rounded border border-app-border bg-app-bg-primary px-2 py-1 text-sm"
                placeholder="Ingredient name"
                value={ing.name}
                onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                required
              />
              <label className="flex items-center gap-1 text-xs text-app-text-muted">
                <input
                  type="checkbox"
                  checked={ing.optional}
                  onChange={(e) => updateIngredient(index, 'optional', e.target.checked)}
                  className="rounded border-app-border"
                />
                Optional
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-app-text-muted">Instructions</label>
        <Textarea
          value={edited.instructions}
          onChange={(e) => setEdited((p) => ({ ...p, instructions: e.target.value }))}
          placeholder="Step by step..."
          rows={5}
          className="w-full"
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-app-border pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Save Recipe</Button>
      </div>
    </motion.form>
  );
}
