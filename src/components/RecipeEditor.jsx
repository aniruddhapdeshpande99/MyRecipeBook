import React, { useState } from 'react';
import './RecipeEditor.css';

export default function RecipeEditor({ existingSlug }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Mains');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState([{ item: '', proportion: '' }]);
  const [steps, setSteps] = useState(['']);

  const addIngredient = () => setIngredients([...ingredients, { item: '', proportion: '' }]);
  const removeIngredient = (idx) => setIngredients(ingredients.filter((_, i) => i !== idx));
  const updateIngredient = (idx, field, val) => {
    const updated = [...ingredients];
    updated[idx][field] = val;
    setIngredients(updated);
  };

  const addStep = () => setSteps([...steps, '']);
  const removeStep = (idx) => setSteps(steps.filter((_, i) => i !== idx));
  const updateStep = (idx, val) => {
    const updated = [...steps];
    updated[idx] = val;
    setSteps(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: existingSlug, title, category, description, ingredients, steps })
    });
    if (res.ok) {
      alert('Recipe Saved!');
      window.location.href = '/';
    } else {
      alert('Error saving recipe');
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
        {ingredients.map((ing, i) => (
          <div key={i} className="dynamic-row">
            <input type="text" placeholder="Item (e.g. Onion)" value={ing.item} onChange={e => updateIngredient(i, 'item', e.target.value)} required />
            <input type="text" placeholder="Proportion (e.g. 2)" value={ing.proportion} onChange={e => updateIngredient(i, 'proportion', e.target.value)} required />
            <button type="button" className="remove-btn" onClick={() => removeIngredient(i)}>✕</button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addIngredient}>+ Add Ingredient</button>
      </div>

      <div className="form-group">
        <label>Steps</label>
        {steps.map((step, i) => (
          <div key={i} className="dynamic-row">
            <span className="step-num">{i + 1}.</span>
            <textarea placeholder="Instruction step..." value={step} onChange={e => updateStep(i, e.target.value)} required />
            <button type="button" className="remove-btn" onClick={() => removeStep(i)}>✕</button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addStep}>+ Add Step</button>
      </div>

      <button type="submit" className="save-btn">Save Cookbook Recipe</button>
    </form>
  );
}
