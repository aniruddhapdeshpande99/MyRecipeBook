import React, { useState, useEffect } from 'react';

// Fallback for iOS Safari < 15.4 which lacks crypto.randomUUID
const uuid = () => typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function RecipeEditor({ existingSlug }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [yieldVal, setYieldVal] = useState('');
  const [ingredients, setIngredients] = useState([{ id: uuid(), item: '', proportion: '' }]);
  const [steps, setSteps] = useState([{ id: uuid(), val: '' }]);
  const [imageUrl, setImageUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!existingSlug);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);

  // Load existing recipe if editing
  useEffect(() => {
    if (!existingSlug) return;
    setIsLoading(true);
    fetch(`/api/recipes?slug=${encodeURIComponent(existingSlug)}`)
      .then(r => r.json())
      .then(data => {
        setTitle(data.title || '');
        setCategory(data.category || '');
        setDescription(data.description || '');
        setImageUrl(data.imageUrl || '');
        setPrepTime(data.prepTime === 'N/A' ? '' : (data.prepTime || ''));
        setCookTime(data.cookTime === 'N/A' ? '' : (data.cookTime || ''));
        setYieldVal(data.yieldVal === 'N/A' ? '' : (data.yieldVal || ''));
        if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
          setIngredients(data.ingredients.map(ing =>
            typeof ing === 'string'
              ? { id: crypto.randomUUID(), item: ing, proportion: '' }
              : { id: crypto.randomUUID(), item: ing.item || '', proportion: ing.proportion || '' }
          ));
        }
        if (Array.isArray(data.steps) && data.steps.length > 0) {
          setSteps(data.steps.map(s => ({ id: crypto.randomUUID(), val: typeof s === 'string' ? s : String(s) })));
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [existingSlug]);

  const addIngredient = () => setIngredients([...ingredients, { id: uuid(), item: '', proportion: '' }]);
  const removeIngredient = (id) => setIngredients(ingredients.filter(i => i.id !== id));
  const updateIngredient = (id, field, val) => setIngredients(ingredients.map(i => i.id === id ? { ...i, [field]: val } : i));

  const addStep = () => setSteps([...steps, { id: uuid(), val: '' }]);
  const removeStep = (id) => setSteps(steps.filter(s => s.id !== id));
  const updateStep = (id, val) => setSteps(steps.map(s => s.id === id ? { ...s, val } : s));

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(false);
    setSaveMessage('Saving recipe...');

    const cleanIngredients = ingredients.map(({ item, proportion }) => ({ item, proportion }));
    const cleanSteps = steps.map(({ val }) => val);

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: existingSlug,
          title,
          category,
          description,
          imageUrl,
          prepTime,
          cookTime,
          yieldVal,
          ingredients: cleanIngredients,
          steps: cleanSteps
        })
      });

      if (res.ok) {
        const saved = await res.json().catch(() => ({}));
        setSaveMessage('Saved! Redirecting...');
        const dest = saved.slug ? `/recipes/${saved.slug}` : '/';
        setTimeout(() => { window.location.href = dest; }, 900);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveMessage(err.error || 'Error saving. Please try again.');
        setSaveError(true);
        setIsSaving(false);
      }
    } catch {
      setSaveMessage('Network error. Please try again.');
      setSaveError(true);
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>
        Loading recipe...
      </div>
    );
  }

  return (
    <form className="recipe-editor" onSubmit={handleSave}>
      <h1>{existingSlug ? 'Edit Recipe' : 'New Recipe'}</h1>

      <div className="form-group">
        <label>Title *</label>
        <input
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Shahi Kaju Paneer"
        />
      </div>

      <div class="form-group">
        <label>Category</label>
        <input
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="e.g. Mains, Sandwiches, Desserts"
        />
      </div>

      <div className="form-group">
        <label>Image URL</label>
        <input
          type="text"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="e.g. /images/aloo-matar.jpg or a web link"
        />
      </div>

      <div className="form-group">
        <label>Description *</label>
        <textarea
          required
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="A rich, creamy..."
        />
      </div>

      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Prep Time</label>
          <input
            type="text"
            value={prepTime}
            onChange={e => setPrepTime(e.target.value)}
            placeholder="e.g. 15 min"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Cook Time</label>
          <input
            type="text"
            value={cookTime}
            onChange={e => setCookTime(e.target.value)}
            placeholder="e.g. 30 min"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Yield / Serves</label>
          <input
            type="text"
            value={yieldVal}
            onChange={e => setYieldVal(e.target.value)}
            placeholder="e.g. 4 servings"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Ingredients</label>
        {ingredients.map((ing) => (
          <div key={ing.id} className="dynamic-row">
            <input
              type="text"
              placeholder="Item (e.g. Onion)"
              value={ing.item}
              onChange={e => updateIngredient(ing.id, 'item', e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Amount (e.g. 2 tbsp)"
              value={ing.proportion}
              onChange={e => updateIngredient(ing.id, 'proportion', e.target.value)}
              style={{ maxWidth: '130px' }}
            />
            <button type="button" className="remove-btn" onClick={() => removeIngredient(ing.id)}>✕</button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addIngredient}>+ Add Ingredient</button>
      </div>

      <div className="form-group">
        <label>Steps</label>
        {steps.map((step, i) => (
          <div key={step.id} className="dynamic-row">
            <span className="step-num">{i + 1}</span>
            <textarea
              placeholder="Instruction step..."
              value={step.val}
              onChange={e => updateStep(step.id, e.target.value)}
              required
            />
            <button type="button" className="remove-btn" onClick={() => removeStep(step.id)}>✕</button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addStep}>+ Add Step</button>
      </div>

      {saveMessage && (
        <div className="save-message" style={saveError ? { backgroundColor: 'rgba(140,59,26,0.1)', color: 'var(--color-terracotta)', borderColor: 'rgba(140,59,26,0.2)' } : {}}>
          {saveMessage}
        </div>
      )}

      <button type="submit" className="save-btn" disabled={isSaving}>
        {isSaving ? 'Saving...' : (existingSlug ? 'Update Recipe' : 'Save Recipe')}
      </button>
    </form>
  );
}
