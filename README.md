
# AnimeShelf

![License](https://img.shields.io/badge/license-GNU%20GPLv3-blue.svg)
![Platform](https://img.shields.io/badge/platform-Desktop%20(Win%2FMac%2FLinux)-lightgrey.svg)

A desktop application for discovering, managing, and tracking your anime series, built with modern web technologies and AI capabilities.

## 📋 Overview

AnimeShelf allows you to:
- Catalog your watched anime and track progress.
- Discover new anime through seasonal overviews and Jikan API search.
- Utilize AI-powered search to find anime based on descriptions.
- Get previews of upcoming seasons and related series based on your shelf.
- View statistics about your watching habits.
- Import and export your anime shelf data.
- Customize the app with light and dark themes.

The app works offline for your personal library data (stored locally), with online functionality for retrieving new anime data and using AI features.

## ✨ Features

### Anime Management & Tracking
- **Add Anime**:
    - Manually input anime details.
    - Search Jikan API by title to auto-populate fields.
    - Add entire series (including prequels/sequels) in one go.
- **View Anime Details**: Display title, cover image, episode count, user rating, status, genres, studios, and more.
- **Track Progress**:
    - Update current episode with easy increment/decrement.
    - Visual progress bars for watch status (including special handling for "Dropped" status).
- **Personal Rating**: Rate anime on a 1-10 scale.
- **Streaming & Broadcast**: Track where you watch anime and their broadcast days.

### Shelf Organization
- **Series Grouping**: Automatically groups related anime (seasons, prequels, sequels) on your shelf for a consolidated view. Click to manage individual entries in a series.
- **Advanced Search & Filtering**:
    - Search your local shelf by title.
    - Global Jikan API search by title.
    - **AI-Powered Search**: Find anime using natural language descriptions.
    - Filter shelf by genre (multi-select), status, rating, and type (multi-select).
- **Customizable Sorting**: Sort your shelf by title, rating, release year, or completion ratio.

### Discovery & Planning
- **Seasonal Overview**: Browse current and past anime seasons, filterable by genre, studio, and type.
- **Preview Page**:
    - Shows upcoming future seasons for anime on your shelf.
    - Lists other related series (current, past) for anime on your shelf.
    - Option to ignore specific anime from previews.

### Data Management
- **Import/Export**:
    - Export your entire shelf to a CSV file.
    - Import anime from a CSV file (fetches missing data from Jikan API if title or MAL ID is provided).
- **Local Data Storage**: All user-specific shelf data is stored in browser `localStorage`.

### Personalization
- **Light/Dark Mode**: Toggle between light and dark themes for comfortable viewing.

### Statistics
- **Visual Insights**: View charts and summaries of your watching habits, including:
    - Overall stats (completed anime, episodes watched, total watch time, top-rated).
    - Monthly watch time over the last 12 months.
    - Genre popularity trends over recent seasons.
    - Anime count by studio for completed shows.

## 🖥️ Supported Platforms

- **Desktop**: Packaged with Electron for Windows, macOS, and Linux.

## 🔧 Development

### Technology Stack

- **Core Framework**: Next.js (v15+ with App Router)
- **UI Library**: React (v18+)
- **Component Library**: ShadCN UI
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **State Management**: React Context API (for shelf and theme)
- **AI Features**: Genkit (Google AI for AI-powered search)
- **Desktop Packaging**: Electron
- **Data Storage**: Browser `localStorage`
- **External Anime API**: Jikan API (v4)

### Project Structure

```
animeshelf/
├── electron/                 # Electron main process code (main.ts, tsconfig.json)
├── public/                   # Static assets
├── src/
│   ├── ai/                   # Genkit AI flows and configuration
│   ├── app/                  # Next.js App Router (pages, layout, API routes)
│   │   ├── (pages)/          # Route groups for main pages
│   │   │   ├── page.tsx      # My Shelf page
│   │   │   ├── seasonal/
│   │   │   ├── preview/
│   │   │   └── stats/
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Global styles & ShadCN theme variables
│   ├── components/           # React components (UI, anime, layout, stats, io)
│   │   ├── anime/
│   │   ├── io/
│   │   ├── layout/
│   │   ├── preview/
│   │   ├── shelf/
│   │   ├── stats/
│   │   └── ui/               # ShadCN UI components
│   ├── contexts/             # React context providers (AnimeShelfContext, ThemeContext)
│   ├── hooks/                # Custom React hooks (useToast, useMobile)
│   ├── lib/                  # Utility functions and API clients (jikanApi, utils)
│   └── types/                # TypeScript type definitions
├── next.config.ts            # Next.js configuration
├── package.json              # Project dependencies and scripts
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

## 🔄 Data Sources

This app uses the [Jikan API (v4)](https://jikan.moe/) (an unofficial MyAnimeList API) for anime data. The API is free to use and provides comprehensive information on thousands of anime series. Please be mindful of their rate limits (requests are delayed in-app to help with this).

## 🤝 Contributing

We welcome contributions to improve the app! Here's how you can help:

1.  Fork the repository
2.  Create a feature branch: `git checkout -b feature/new-feature`
3.  Commit your changes: `git commit -m 'Add new feature'`
4.  Push to the branch: `git push origin feature/new-feature`
5.  Create a Pull Request

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the License file for details.

## 📊 Privacy

This app stores all your personal shelf data locally on your device using browser `localStorage`. No personal shelf data is transmitted to any external servers. API requests are made to the Jikan API to fetch anime information and to Google AI services (via Genkit) for the AI search feature, as per their respective privacy policies.

---

📦 Developed with Next.js, React, Electron & Genkit in Firebase Studio with Gemini
