# Anime Tracker

![License](https://img.shields.io/badge/license-GNU%20GPLv3-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20|%20Android-lightgrey.svg)

A cross-platform application for managing and tracking anime series. Available for Windows desktop and Android devices.

## 📋 Overview

Anime Tracker allows you to:
- Catalog your watched anime
- Discover new anime and add them to your watchlist
- Track your watching progress
- Add personal ratings and notes
- Browse seasonal anime overviews
- Filter and sort all anime by various criteria

The app works completely offline for your personal library, with optional online functionality for retrieving new anime data.

## ✨ Features

### Anime Management
- Comprehensive database with over 17,000 anime entries
- Detailed information for each anime (title, studio, episode count, etc.)
- Personal status tracking (watching, completed, etc.)
- Rating system (1-10 stars)
- Categorization by genres

### Progress Tracking
- Save and update current episode
- Quick +1 button for easy progress updates
- Visual progress bars

### Seasonal Overview
- Browse current and past anime seasons
- Group by season (Winter, Spring, Summer, Fall + Year)
- Add anime directly from the seasonal view to your list

### Customizable Interface
- List and tile view for the library
- Multiple sorting options
- Light and dark design

## 🖥️ Supported Platforms

- **Windows**: Windows 10 and 11
- **Android**: Android 8.0 and higher

## 🔧 Development

### Technology Stack

- **Frontend**: React (18.x)
- **Mobile**: React Native (0.70.x or newer)
- **Desktop**: Electron (24.x or newer)
- **Language**: JavaScript/TypeScript
- **State Management**: Redux or MobX
- **Database**: SQLite3
- **API**: Jikan API (unofficial MyAnimeList API)

### Project Structure

```
anime-tracker/
├── src/                      # Shared source code
│   ├── api/                  # API services
│   ├── assets/               # Images, fonts
│   ├── components/           # UI components
│   ├── database/             # SQLite operations
│   ├── navigation/           # Navigation
│   ├── screens/              # Main screens
│   ├── store/                # Redux/MobX store
│   └── utils/                # Helper functions
├── electron/                 # Electron-specific
├── android/                  # React Native Android
└── package.json
```

## 🔄 Data Sources

This app uses the [Jikan API](https://jikan.moe/) (unofficial MyAnimeList API) for anime data. The API is free to use and provides comprehensive information on thousands of anime series.

## 🤝 Contributing

We welcome contributions to improve the app! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -m 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Create a Pull Request

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the License file for details.

## 📊 Privacy

This app stores all your data locally on your device. No personal data is transmitted to servers, except for API requests to the Jikan API for new anime information.

---

📦 Developed with React Native & Electron in Firebase Studio with Gemini