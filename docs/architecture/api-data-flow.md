# API Data Flow Architecture

This diagram details the exact logic within `src/pages/api/recipes.ts`.

```mermaid
sequenceDiagram
    participant Client as React Frontend
    participant API as recipes.ts API
    participant FS as File System
    participant Parser as recipeParser.js

    %% GET Request Flow
    Note over Client, FS: GET /api/recipes?slug={slug}
    Client->>API: GET Request (Fetch Recipe)
    API->>FS: Check if `data/recipes/{slug}/{slug}.md` exists
    alt Exists in structured storage
        FS-->>API: Return Markdown File
    else Exists in flat storage
        FS-->>API: Return `data/recipes/{slug}.md`
    end
    API->>Parser: Parse Raw Markdown Content
    Parser-->>API: Return Parsed frontmatter & body
    API->>API: Extract missing ingredients/steps from body via Regex
    API->>FS: Check for `hero.jpg` existence
    API-->>Client: Return JSON Payload (200 OK)

    %% POST Request Flow
    Note over Client, FS: POST /api/recipes
    Client->>API: POST JSON (slug, title, images, steps)
    API->>API: Sanitize Slug & Title
    API->>FS: mkdir -p `data/recipes/{slug}`
    
    alt Contains Base64 Hero Image
        API->>FS: Write `hero.ext` buffer to disk
    end
    
    alt Contains Base64 Mise En Place Images
        API->>FS: mkdir -p `data/recipes/{slug}/miseenplace`
        API->>FS: Write `mise-{timestamp}-{id}.ext` buffers to disk
    end
    
    API->>API: Compile Ingredients & Instructions into Markdown String
    API->>API: stringify frontmatter (gray-matter)
    API->>FS: Write `{slug}.md` to disk
    API-->>Client: Return Success JSON (200 OK)
```
