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
  const [isDragActive, setIsDragActive] = useState(false);
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

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

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

      <div className="form-group">
        <label>Category</label>
        <input
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="e.g. Mains, Sandwiches, Desserts"
        />
      </div>

      <div className="form-group">
        <label>Recipe Image</label>
        {imageUrl ? (
          <div className="image-preview-container" style={{
            position: 'relative',
            borderRadius: '8px',
            border: '2px solid var(--color-border)',
            overflow: 'hidden',
            backgroundColor: 'var(--color-cream-surface)',
            maxWidth: '100%',
            height: '240px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <img 
              src={imageUrl} 
              alt="Recipe Preview" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'var(--color-terracotta)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                fontSize: '14px'
              }}
              title="Remove image"
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`file-upload-zone ${isDragActive ? 'drag-active' : ''}`}
            style={{
              border: '2px dashed var(--color-border)',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: isDragActive ? 'rgba(62, 86, 67, 0.05)' : 'transparent',
              borderColor: isDragActive ? 'var(--color-sage)' : 'var(--color-border)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '160px'
            }}
            onClick={() => document.getElementById('recipe-image-input').click()}
          >
            <svg 
              width="36" 
              height="36" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="var(--color-sage)" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ marginBottom: '0.75rem', opacity: 0.8 }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500', color: 'var(--color-sage)' }}>
              Drag and drop your image here, or <span style={{ textDecoration: 'underline', color: 'var(--color-terracotta)' }}>browse</span>
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              Supports JPG, JPEG, PNG
            </p>
            <input
              id="recipe-image-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Description *</label>
        <textarea
          required
          value={description}
          onChange={e => setDescription(e.target.value)}
          onInput={autoResize}
          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
          style={{ overflow: 'hidden', minHeight: '100px' }}
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
              onInput={autoResize}
              ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
              style={{ overflow: 'hidden', minHeight: '60px' }}
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
