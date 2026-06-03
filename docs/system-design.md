# System Design

This document outlines the architecture and data flow of the Personal Recipe Collection App.

## Architecture Diagram

The diagram below illustrates how the React frontend components interact with the Astro backend APIs, and how those APIs interface with the local file system to store and retrieve recipes.

```mermaid
flowchart LR
    subgraph Frontend ["Frontend (React/Astro)"]
        Editor[Recipe Editor]
        RecipeView[Recipe View]
        DiaryView[Cooking Diary Modal]
    end

    subgraph API ["Backend (Astro API)"]
        GET_Recipes["GET /api/recipes"]
        POST_Recipe["POST /api/recipes"]
        POST_Diary["POST /api/diary"]
        GET_Img["GET /images/[...path]"]
    end

    subgraph FS ["File System (Persistent Volume)"]
        subgraph Recipes ["data/recipes/"]
            MD["[slug].md"]
            ImgFolder["[slug]/"]
            MiseFolder["[slug]/miseenplace/"]
            ImgFolder --> MiseFolder
        end
        subgraph Diary ["data/diary/"]
            DiaryJSON["[slug].json"]
            DiaryImgFolder["images/"]
        end
    end

    %% Frontend -> API
    RecipeView -->|"Fetch recipe list"| GET_Recipes
    Editor -->|"Save recipe & images"| POST_Recipe
    DiaryView -->|"Upload diary entry"| POST_Diary
    RecipeView -->|"Load images"| GET_Img
    DiaryView -->|"Load images"| GET_Img

    %% API -> FS
    GET_Recipes -.->|"Read markdown files"| MD
    POST_Recipe -.->|"Write markdown"| MD
    POST_Recipe -.->|"Write images"| ImgFolder
    POST_Diary -.->|"Write JSON"| DiaryJSON
    POST_Diary -.->|"Write images"| DiaryImgFolder
    GET_Img -.->|"Read images"| ImgFolder
    GET_Img -.->|"Read images"| DiaryImgFolder

    %% Styles
    classDef frontend fill:#e3f2fd,stroke:#1e88e5,stroke-width:2px;
    classDef api fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef storage fill:#e8f5e9,stroke:#43a047,stroke-width:2px;
    
    class Editor,RecipeView,DiaryView frontend;
    class GET_Recipes,POST_Recipe,POST_Diary,GET_Img api;
    class MD,ImgFolder,MiseFolder,DiaryJSON,DiaryImgFolder storage;
```

## Mobile Compatibility & Connection

To ensure seamless compatibility when connecting from mobile devices (such as an iPhone), the frontend is built to be resilient across various browser environments.

Specifically, the `Editor Component` handles local state and unique identifiers using a `crypto.randomUUID()` fallback implementation. This ensures that even on older iOS Safari versions—which may not natively support the modern `crypto.randomUUID` API—the frontend can still reliably generate UUIDs for state management and recipe saving without breaking.
