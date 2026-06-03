# Personal Recipe Collection App

A self-hosted recipe management application built with Astro (SSR), Tailwind CSS, and React components. It provides an intuitive interface for managing your personal recipe collection, utilizing structured Markdown storage and supporting local image uploads. The app is containerized with Docker for easy deployment and includes an automated daily backup system.

## Features

- **Astro SSR:** Fast, server-side rendered web application.
- **Markdown Storage:** Recipes are stored as structured Markdown files.
- **Local Image Uploads:** Attach images directly to your recipes.
- **Docker Support:** Ready for self-hosted production deployment.
- **Automated Backups:** Custom daily backup script (`backup_cron.js`) to safeguard your data.
- **Responsive Design:** Accessible from any device (browser/phone) on your local network.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (for local development)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (for production deployment)

### Development Setup

1. Navigate to the project root:
   ```bash
   cd "Personal Recipe Collection App"
   ```

2. Install the necessary dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:4321`.

### Production Setup (Docker)

For a production environment, you can easily run the app using Docker Compose.

1. Ensure Docker daemon is running on your host machine.
2. Build and start the container in detached mode:
   ```bash
   docker-compose up -d --build
   ```
3. The app will be accessible at `http://localhost:4321`. You can access it from your phone or other devices on the same local network using your host machine's IP address (e.g., `http://192.168.1.X:4321`).

## Usage

- **Accessing the App:** Open your web browser and navigate to the application URL.
- **Creating Recipes:** Use the web interface to add new recipes. You can specify ingredients, instructions, and metadata.
- **Uploading Images:** You can upload images while creating or editing a recipe. The images are stored locally and linked to the recipe Markdown.

## System Architecture & Walkthrough

The application is built to be a simple but robust local-first platform:

1. **Frontend (React + Tailwind CSS in Astro):** 
   - The user interface is driven by React components hosted inside an Astro framework.
   - **Mobile Compatibility (UUID Fallback):** To ensure a seamless connection and usage from older mobile devices, particularly iOS Safari, the React frontend (`src/components/RecipeEditor.jsx`) uses a `crypto.randomUUID` fallback polyfill. This ensures that state management during recipe editing and component rendering does not break when accessing the app from your phone over the local network.
2. **Backend (Astro Server-Side Rendering):** 
   - Receives form submissions and image uploads from the frontend.
   - Handles the conversion of recipe form data into Markdown content with frontmatter.
3. **Storage (File System):** 
   - No complex database is required. The backend directly reads and writes `.md` and image files to the local disk.

## Data Storage Structure

Recipes and their associated media are stored persistently in a structured format within the `data/recipes/` directory.

### Format Details

Each recipe gets its own isolated directory named after its URL-friendly slug.

```text
data/recipes/
└── [slug]/
    ├── recipe.md    # The main Markdown file containing recipe details (ingredients, instructions, frontmatter metadata).
    └── images/      # A subfolder containing all local images uploaded for this specific recipe.
```

## Backups

The application includes a custom automated daily backup script (`backup_cron.js`).

- **Functionality:** It creates an archive of your entire `data/` directory (where recipes and images are stored) to prevent accidental data loss.
- **Execution:** The script is configured to run automatically as a daily cron job when the application is running. You can inspect `backup_cron.js` for the exact cron schedule or to trigger manual backups.
