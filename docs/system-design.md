# System Design

This document outlines the architecture and data flow of the Personal Recipe Collection App.

## Architecture Diagram

The diagram below illustrates how the React frontend components interact with the Astro backend APIs, and how those APIs interface with the local file system to store and retrieve recipes.

```mermaid
flowchart LR
    subgraph Frontend ["Frontend (React)"]
        Editor[Editor Component]
        RecipeView[Recipe View Component]
    end

    subgraph API ["Backend (Astro API)"]
        GET_List["GET /api/recipes"]
        GET_One["GET /api/recipes?slug=[slug]"]
        POST_Save["POST /api/recipes"]
        GET_Img["GET /images/[...path]"]
    end

    subgraph FS ["File System Storage"]
        Folder["data/recipes/[slug]/"]
        MD["recipe.md"]
        ImgFolder["images/"]
        Folder --> MD
        Folder --> ImgFolder
    end

    %% Frontend -> API
    RecipeView -->|"Fetch recipe list"| GET_List
    RecipeView -->|"Fetch recipe details"| GET_One
    RecipeView -->|"Load recipe image"| GET_Img
    Editor -->|"Save recipe & images"| POST_Save

    %% API -> FS
    GET_List -.->|"Read directory contents"| Folder
    GET_One -.->|"Read markdown content"| MD
    POST_Save -.->|"Write markdown & upload images"| Folder
    GET_Img -.->|"Read image files"| ImgFolder

    %% Styles
    classDef frontend fill:#e3f2fd,stroke:#1e88e5,stroke-width:2px;
    classDef api fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef storage fill:#e8f5e9,stroke:#43a047,stroke-width:2px;
    
    class Editor,RecipeView frontend;
    class GET_List,GET_One,POST_Save,GET_Img api;
    class Folder,MD,ImgFolder storage;
```

## Mobile Compatibility & Connection

To ensure seamless compatibility when connecting from mobile devices (such as an iPhone), the frontend is built to be resilient across various browser environments.

Specifically, the `Editor Component` handles local state and unique identifiers using a `crypto.randomUUID()` fallback implementation. This ensures that even on older iOS Safari versions—which may not natively support the modern `crypto.randomUUID` API—the frontend can still reliably generate UUIDs for state management and recipe saving without breaking.
