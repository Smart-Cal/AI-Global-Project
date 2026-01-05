# PALM - Personal AI Life Manager

<div align="center">

**Your Intelligent Life Assistant that Actually Takes Action**

*Beyond conversation — PALM executes tasks, manages your schedule, and connects to real-world services*

[Features](#-key-features) • [Architecture](#-architecture) • [MCP Integration](#-mcp-integration) • [Getting Started](#-getting-started) • [API Reference](#-api-reference) • [Recent Updates](#recent-updates)

</div>

---

## What is PALM?

PALM (Personal AI Life Manager) is an **AI-powered life management platform** that goes far beyond traditional chatbots. While regular LLMs like ChatGPT or Claude can only provide text-based answers, PALM is an **"Acting AI"** that actually executes tasks on your behalf.

### The Problem with Traditional LLMs

| Traditional LLM | PALM |
|----------------|------|
| "Here are some restaurant recommendations..." (text only) | Actually searches Google Maps, shows photos, ratings, and lets you add to calendar |
| "You could schedule a meeting at 3pm..." | Checks your calendar for conflicts, creates the event, sends invites |
| "Here's a gift idea for your friend..." | Searches real products with prices, shows images, provides purchase links |
| Forgets context between sessions | Maintains conversation history and learns your preferences |
| Generic responses | Personalized based on your chronotype, schedule patterns, and goals |

---

## Key Features

### 1. Intelligent Schedule Management
- **Natural Language Processing**: "Meeting with John tomorrow at 3pm at Starbucks" → automatically creates event
- **Smart Conflict Detection**: AI checks for scheduling conflicts before creating events
- **Multi-day & All-day Events**: Support for events spanning multiple days with visual bars in week view
- **Fixed Header Week View**: Scrollable time grid with fixed day headers and all-day events bar
- **Google Calendar Sync**: Two-way sync with your existing Google Calendar

### 2. Goal-Oriented Task Management
- **Goal Decomposition**: Break down big goals into actionable tasks automatically
- **Progress Tracking**: Visual progress bars and completion rates
- **Smart Prioritization**: AI suggests which tasks to focus on based on deadlines and importance
- **Linked Tasks**: Connect TODOs to goals for better organization
- **Inline TODO Editing**: Edit TODO details directly from the schedule view
- **Category Management**: Create and assign categories to organize tasks and events

### 3. Acting AI with MCP (Model Context Protocol)

PALM implements **MCP (Model Context Protocol)** to connect AI with real-world services:

#### Restaurant & Place Recommendations
- Real-time search via **Google Maps/Places API**
- Actual photos, ratings, reviews, and operating hours
- Distance calculation from your location
- One-click addition to your schedule

#### Shopping & Gift Recommendations
- Product search via **SerpAPI (Google Shopping)**
- Real prices, images, and purchase links
- Gift suggestions based on recipient and occasion
- Budget-aware recommendations

#### Weather-Aware Planning
- **OpenWeather API** integration
- Weather-based activity suggestions
- Rain/snow alerts for outdoor events

#### News & Information
- Curated news via **News API**
- Topic-based filtering
- Stay informed without leaving the app

### 4. Group Collaboration
- **Group Scheduling**: Find common available times across team members
- **Shared Goals**: Collaborate on team objectives
- **Meeting Coordination**: AI finds optimal meeting times for everyone

### 5. Life Logging
- **Daily Diary**: AI-generated summaries of your day
- **Activity Tracking**: Automatic logging of completed tasks
- **Reflection Prompts**: Guided journaling for personal growth

### 6. Modern Dashboard
- **Quick AI Input**: Direct AI assistant access from dashboard with natural language input
- **Today's Schedule Overview**: See upcoming events and tasks at a glance
- **Weather Widget**: Current weather conditions integrated into daily planning
- **Quick Actions**: Fast access to create events, todos, and goals

### 7. Enhanced UI/UX
- **Custom Confirm Modals**: Consistent confirmation dialogs throughout the app
- **Toast Notifications**: Non-intrusive feedback for user actions
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Category Color Coding**: Visual organization with customizable colors
- **Collapsible Sidebars**: Toggle sidebar visibility in calendar and other views

---

## How PALM Differs from ChatGPT/Claude

| Feature | ChatGPT/Claude | PALM |
|---------|---------------|------|
| **Action Execution** | Text responses only | Actually creates events, searches products, books reservations |
| **Real-time Data** | Knowledge cutoff limitations | Live data from Google Maps, Shopping APIs, Weather |
| **Personal Context** | Starts fresh each conversation | Remembers your schedule, preferences, goals |
| **Calendar Integration** | None | Full Google Calendar sync |
| **Visual Results** | Text descriptions | Rich cards with images, ratings, prices |
| **Confirmation Flow** | N/A | Review and approve before actions are taken |
| **Chronotype Awareness** | Generic advice | Personalized scheduling based on your body clock |

### The "Acting AI" Paradigm

```
Traditional AI Flow:
User → LLM → Text Response → User manually takes action

PALM Flow:
User → AI Agent → MCP Tools → External APIs → Formatted Results → User Confirms → Action Executed
```

---

## MCP Integration

### What is MCP?

**Model Context Protocol (MCP)** is a framework that allows AI models to interact with external tools and services. PALM implements MCP to transform the AI from a "talking assistant" into an "acting assistant."

### MCP Architecture in PALM

```
┌─────────────────────────────────────────────────────────────────┐
│                        PALM Backend                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Router     │ → │  MCP Agent   │ → │ Orchestrator │      │
│  │   Agent      │    │    Loop      │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                              │                   │              │
│                              ▼                   ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MCP Tool Registry                     │   │
│  ├─────────────┬─────────────┬─────────────┬───────────────┤   │
│  │  Calendar   │    Maps     │  Shopping   │     News      │   │
│  │   Tools     │    Tools    │    Tools    │    Tools      │   │
│  └─────────────┴─────────────┴─────────────┴───────────────┘   │
│         │              │            │              │            │
└─────────│──────────────│────────────│──────────────│────────────┘
          ▼              ▼            ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
   │  Google    │ │  Google    │ │  SerpAPI   │ │  News API  │
   │  Calendar  │ │   Maps     │ │            │ │            │
   └────────────┘ └────────────┘ └────────────┘ └────────────┘
```

### Available MCP Tools

#### Calendar Tools
| Tool | Description |
|------|-------------|
| `calendar_create_event` | Create new calendar event |
| `calendar_list_events` | List events for date range |
| `calendar_check_conflicts` | Check for scheduling conflicts |
| `calendar_get_free_busy` | Find available time slots |
| `calendar_update_event` | Modify existing event |
| `calendar_delete_event` | Remove event |

#### Maps Tools
| Tool | Description |
|------|-------------|
| `maps_search_places` | Search for places by query |
| `maps_recommend_restaurants` | Get restaurant recommendations with photos |
| `maps_get_place_details` | Get detailed place information |
| `maps_get_distance` | Calculate distance/duration between locations |
| `maps_find_midpoint` | Find meeting point for multiple people |

#### Shopping Tools
| Tool | Description |
|------|-------------|
| `shopping_search` | Search products on Google Shopping |
| `shopping_recommend_gifts` | Get gift recommendations |
| `shopping_compare_prices` | Compare prices across sellers |
| `shopping_goal_recommendations` | Products related to your goals |

#### Integrated Tools
| Tool | Description |
|------|-------------|
| `plan_group_meeting` | Coordinate group schedules + find venue |
| `prepare_special_day` | Plan special occasions (restaurant + gift) |

---

## Architecture

### Technology Stack

#### Frontend
- **React 18** + **TypeScript** - UI Framework
- **Vite** - Build tool & dev server
- **Zustand** - State management
- **React Router v6** - Navigation

#### Backend
- **Node.js** + **Express** + **TypeScript** - API Server
- **OpenAI GPT-4o** - AI Engine
- **Supabase** - Database & Authentication

#### External APIs
- **Google Calendar API** - Calendar sync
- **Google Maps/Places API** - Location services
- **SerpAPI** - Google Shopping search
- **OpenWeather API** - Weather data
- **News API** - News aggregation

### Project Structure

```
palm/
├── src/                          # Frontend
│   ├── components/
│   │   ├── views/
│   │   │   ├── AssistantView.tsx    # AI Chat with MCP cards
│   │   │   ├── CalendarView.tsx     # Calendar UI with week/month views
│   │   │   ├── NewDashboard.tsx     # Dashboard with AI input & weather
│   │   │   ├── ScheduleView.tsx     # TODO list with inline editing
│   │   │   ├── GoalView.tsx         # Goal management
│   │   │   └── GroupsView.tsx       # Group collaboration
│   │   ├── EventModal.tsx           # Event creation/editing with multi-day support
│   │   ├── TodoModal.tsx            # TODO creation with categories
│   │   ├── ConfirmModal.tsx         # Custom confirmation dialogs
│   │   ├── DatePicker.tsx           # Custom date picker component
│   │   ├── TimePicker.tsx           # Custom time picker component
│   │   └── Toast.tsx                # Toast notifications
│   ├── services/
│   │   └── api.ts                   # Backend API client
│   └── store/                       # Zustand stores
│       ├── eventStore.ts            # Event state management
│       ├── todoStore.ts             # TODO state management
│       ├── goalStore.ts             # Goal state management
│       └── categoryStore.ts         # Category state management
│
├── backend/
│   └── src/
│       ├── agents/                  # AI Agents
│       │   ├── mcpAgentLoop.ts      # Main MCP agent
│       │   ├── orchestrator.ts      # Agent orchestration
│       │   ├── parserAgent.ts       # NLP parsing
│       │   └── tools/               # Tool definitions
│       ├── mcp/                     # MCP Implementations
│       │   ├── googleCalendar.ts    # Calendar MCP
│       │   ├── googleMaps.ts        # Maps MCP
│       │   ├── shopping.ts          # Shopping MCP
│       │   ├── news.ts              # News MCP
│       │   └── orchestrator.ts      # MCP orchestrator
│       ├── routes/                  # API Routes
│       └── services/                # Business logic
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- API keys for external services

### Installation

```bash
# Clone the repository
git clone https://github.com/Smart-Cal/AI-Global-Project.git
cd palm

# Install all dependencies
npm run install:all

# Start development servers
npm run dev:all
```

### Environment Variables

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_KEY=your-supabase-anon-key
```

#### Backend (backend/.env)
```env
# Required - Core Services
PORT=3001
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
SUPABASE_ANON_KEY=your-supabase-anon-key
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-jwt-secret

# Optional - Enhanced Features
OPENWEATHER_API_KEY=your-openweather-api-key

# Optional - MCP Integration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
SERPAPI_API_KEY=your-serpapi-api-key
NEWS_API_KEY=your-news-api-key
```

---

## API Reference

### Chat API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message to AI (returns MCP data) |
| `/api/chat/confirm-events` | POST | Confirm and save pending events |
| `/api/chat/confirm-todos` | POST | Confirm and save pending TODOs |
| `/api/chat/confirm-goals` | POST | Confirm and save pending goals |

### Events API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | List events |
| `/api/events` | POST | Create event |
| `/api/events/:id` | PUT | Update event |
| `/api/events/:id` | DELETE | Delete event |

### Goals API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/goals` | GET | List goals |
| `/api/goals` | POST | Create goal |
| `/api/goals/:id/decompose` | POST | AI decompose goal into tasks |

### Groups API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/groups` | GET/POST | List/Create groups |
| `/api/groups/:id/chat` | POST | Group AI assistant |
| `/api/groups/:id/find-time` | POST | Find common available times |

---

## Use Cases

### 1. Planning a Birthday Dinner
```
User: "I want to plan a birthday dinner for my girlfriend next Saturday"

PALM:
1. Checks your calendar for conflicts
2. Searches restaurants with romantic atmosphere
3. Shows cards with photos, ratings, prices
4. Recommends gift ideas based on budget
5. Creates calendar event after your confirmation
```

### 2. Team Meeting Coordination
```
User: "Schedule a team meeting with john@example.com and jane@example.com next week"

PALM:
1. Checks all members' calendar availability
2. Finds overlapping free slots
3. Suggests meeting locations (midpoint)
4. Creates event and sends invites
```

### 3. Goal Achievement
```
User: "I want to learn Korean in 6 months"

PALM:
1. Creates goal with target date
2. Decomposes into weekly tasks
3. Schedules study sessions based on your chronotype
4. Recommends learning resources
5. Tracks progress over time
```

---

## Recent Updates

### Calendar Enhancements
- **Multi-day Events**: Events can now span multiple days with separate start and end dates
- **All-day Events Bar**: All-day and multi-day events displayed as horizontal bars below day headers in week view
- **Fixed Header Scrolling**: Week view time grid scrolls independently while headers stay fixed
- **Category Filtering**: Filter calendar events by category with sidebar checkboxes

### Task Management Improvements
- **Inline TODO Editing**: Edit TODO title, description, deadline, and priority directly in the schedule view
- **Category Creation**: Add new categories with custom colors directly from TODO/Event creation forms
- **Duration Selector**: Set task duration in hours and minutes (not just minutes)
- **Improved Priority Display**: Visual priority indicators with color coding

### UI/UX Updates
- **Custom Date/Time Pickers**: Consistent, styled date and time input components
- **Confirm Modal System**: Unified confirmation dialogs replacing browser alerts
- **Toast Notifications**: Success/error feedback for all user actions
- **Collapsible Sidebar**: Toggle calendar sidebar visibility with a button

---

## Roadmap

- [ ] Voice input/output
- [ ] Mobile app (React Native)
- [ ] More MCP integrations (Uber, OpenTable, etc.)
- [ ] Team workspace features
- [ ] AI-powered analytics and insights
- [ ] Multi-language support
- [ ] Recurring events support
- [ ] Drag-and-drop event rescheduling

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**PALM - Because your AI assistant should do more than just talk.**

Made with ❤️ by Smart-Cal Team

</div>
