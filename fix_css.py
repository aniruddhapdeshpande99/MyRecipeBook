import codecs

with codecs.open('src/styles/global.css', 'r', 'utf-8', errors='ignore') as f:
    lines = f.readlines()

clean_lines = lines[:1577]

css_append = '''
/* ============================================================
   GALLERY CAROUSEL
   ============================================================ */
.gallery-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: rgba(15, 26, 18, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.gallery-modal-overlay[style*="display: block"],
.gallery-modal-overlay[style*="display: flex"] {
  opacity: 1;
  visibility: visible;
}

.gallery-carousel-content {
  position: relative;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gallery-carousel-content img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.gallery-carousel-caption {
  margin-top: 1.5rem;
  color: var(--color-cream);
  font-family: var(--font-sans);
  font-size: 1.1rem;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0,0,0,0.8);
}

.gallery-nav-btn {
  position: absolute;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10000;
}

.gallery-nav-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.1);
}

.gallery-nav-btn svg {
  width: 28px;
  height: 28px;
}

.gallery-close-btn {
  top: 2rem;
  right: 2rem;
  font-size: 1.5rem;
  font-family: var(--font-sans);
  font-weight: 300;
}

.gallery-prev-btn {
  left: 2rem;
  top: 50%;
  transform: translateY(-50%);
}
.gallery-prev-btn:hover {
  transform: translateY(-50%) scale(1.1);
}

.gallery-next-btn {
  right: 2rem;
  top: 50%;
  transform: translateY(-50%);
}
.gallery-next-btn:hover {
  transform: translateY(-50%) scale(1.1);
}

@media (max-width: 768px) {
  .gallery-nav-btn {
    width: 44px;
    height: 44px;
  }
  .gallery-prev-btn { left: 1rem; }
  .gallery-next-btn { right: 1rem; }
  .gallery-close-btn { top: 1rem; right: 1rem; }
}
'''

with codecs.open('src/styles/global.css', 'w', 'utf-8') as f:
    f.writelines(clean_lines)
    f.write(css_append)
