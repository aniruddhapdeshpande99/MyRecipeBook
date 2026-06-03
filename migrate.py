import os
import shutil
import re
import codecs

data_recipes = os.path.join('data', 'recipes')
public_images = os.path.join('public', 'images')

def migrate():
    # 1. Find all .md files directly in data/recipes
    md_files = [f for f in os.listdir(data_recipes) if f.endswith('.md') and os.path.isfile(os.path.join(data_recipes, f))]
    
    for md_file in md_files:
        slug = md_file[:-3]
        recipe_dir = os.path.join(data_recipes, slug)
        
        # Create directory
        os.makedirs(recipe_dir, exist_ok=True)
        
        # Move markdown file
        old_md_path = os.path.join(data_recipes, md_file)
        new_md_path = os.path.join(recipe_dir, md_file)
        
        # Read and update content before moving
        with codecs.open(old_md_path, 'r', 'utf-8') as f:
            content = f.read()
        
        # Move images from public/images
        # Common extensions
        for ext in ['.jpg', '.jpeg', '.png', '.webp']:
            # Move main image
            old_img_path = os.path.join(public_images, f"{slug}{ext}")
            new_img_filename = f"hero{ext}"
            new_img_path = os.path.join(recipe_dir, new_img_filename)
            
            if os.path.exists(old_img_path):
                shutil.move(old_img_path, new_img_path)
                # Update imageUrl in frontmatter
                content = re.sub(rf"imageUrl:\s*['\"]?/images/{slug}{ext}['\"]?", f"imageUrl: /images/{slug}/{new_img_filename}", content)
                content = re.sub(rf"imageUrl:\s*['\"]?/images/{slug}\.jpg['\"]?", f"imageUrl: /images/{slug}/{new_img_filename}", content)
        
        # Move miseenplace images
        mise_dir = os.path.join(public_images, 'miseenplace')
        if os.path.exists(mise_dir):
            for mise_file in os.listdir(mise_dir):
                if mise_file.startswith(slug):
                    old_mise_path = os.path.join(mise_dir, mise_file)
                    new_mise_dir = os.path.join(recipe_dir, 'miseenplace')
                    os.makedirs(new_mise_dir, exist_ok=True)
                    new_mise_path = os.path.join(new_mise_dir, mise_file)
                    
                    shutil.move(old_mise_path, new_mise_path)
                    
                    # Update miseEnPlace in frontmatter
                    # Regex replace /images/miseenplace/[file] with /images/[slug]/miseenplace/[file]
                    content = content.replace(f"/images/miseenplace/{mise_file}", f"/images/{slug}/miseenplace/{mise_file}")
        
        # Write updated content
        with codecs.open(new_md_path, 'w', 'utf-8') as f:
            f.write(content)
        
        # Delete original markdown if write successful
        if os.path.exists(old_md_path):
            os.remove(old_md_path)

if __name__ == "__main__":
    migrate()
    print("Migration complete!")
