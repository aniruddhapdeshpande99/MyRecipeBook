import React, { useState } from 'react';
import './RecipeEditor.css';

export default function RecipeEditor({ existingSlug }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Mains');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState([{ id: crypto.randomUUID(), item: '', proportion: '' }]);
  const [steps, setSteps] = useState([{ id: crypto.randomUUID(), val: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const addIngredient = () => setIngredients([...ingredients, { id: crypto.randomUUID(), item: '', proportion: '' }]);
  const removeIngredient = (id) => setIngredients(ingredients.filter(ing => ing.id !== id));
  const updateIngredient = (id, field, val) => {
    setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, [field]: val } : ing));
  };

  const addStep = () => setSteps([...steps, { id: crypto.randomUUID(), val: '' }]);
  const removeStep = (id) => setSteps(steps.filter(s => s.id !== id));
  const updateStep = (id, val) => {
    setSteps(steps.map(s => s.id === id ? { ...s, val } : s));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('Saving recipe...');
    
    // Strip IDs before sending to API to keep the markdown clean
    const cleanIngredients = ingredients.map(({ item, proportion }) => ({ item, proportion }));
    const cleanSteps = steps.map(({ val }) => val);

    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: existingSlug, title, category, description, ingredients: cleanIngredients, steps: cleanSteps })
    });
    if (res.ok) {
      setSaveMessage('Recipe saved successfully! Redirecting...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } else {
      setSaveMessage('Error saving recipe. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <form className="recipe-editor" onSubmit={handleSave}>
      <h1>{existingSlug ? 'Edit Recipe' : 'New Recipe'}</h1>
      
      <div className="form-group">
        <label>Title</label>
        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Shahi Kaju Paneer" />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="A rich, creamy..." />
      </div>

      <div className="form-group">
        <label>Ingredients</label>
        {ingredients.map((ing) => (
          <div key={ing.id} className="dynamic-row">
            <input type="text" placeholder="Item (e.g. Onion)" value={ing.item} onChange={e => updateIngredient(ing.id, 'item', e.target.value)} required />
            <input type="text" placeholder="Proportion (e.g. 2)" value={ing.proportion} onChange={e => updateIngredient(ing.id, 'proportion', e.target.value)} required />
            <button type="button" className="remove-btn" onClick={() => removeIngredient(ing.id)}>✕</button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addIngredient}>+ Add Ingredient</button>
      </div>

      <div className="form-group">
        <label>Steps</label>
        {steps.map((step, i) => (
          <div key={step.id} className="dynamic-row">
            <span className="step-num">{i + 1}.</span>
            <textarea placeholder="Instruction step..." value={step.val} onChange={e => updateStep(step.id, e.target.value)} required />
            <button type="button" className="remove-btn" onClick={() => removeStep(step.id)}>✕</button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addStep}>+ Add Step</button>
      </div>

      {saveMessage && <div className="save-message">{saveMessage}</div>}
      <button type="submit" className="save-btn" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Cookbook Recipe'}
      </button>
    </form>
  );
}
