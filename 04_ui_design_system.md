1️⃣ Purpose

Define modern, responsive UI/UX for all system modules

Ensure consistent design language across Academic, Administrative, Finance, Compliance, and Communication modules

Enable ease of use for teachers, parents, students, admin

Support mobile adaptation and future PWA

Produce design specifications that all Claude .md implementations can follow strictly

2️⃣ Design Principles

Responsive Design – works on desktop, tablet, and mobile

Modern UI Standards – flat design, clean typography, subtle shadows, clear hierarchy

Consistency – colors, buttons, forms, tables, charts consistent across modules

Accessibility – high contrast, readable fonts, keyboard navigable

Intuitive Navigation – sidebar + topbar, breadcrumbs for module navigation

Modular Components – reusable buttons, cards, tables, modals, charts, forms

Color Palette – professional, calm colors, minimalistic but appealing (AI to generate)

Feedback Mechanisms – toast notifications, alerts, loading spinners

3️⃣ Layout Guidelines
A. General Structure

Header: school logo, system title, user profile menu

Sidebar: role-based menu items (dynamic)

Main Content Area: module pages, dashboards, forms, tables

Footer: copyright, version info

B. Grid System

Use 12-column responsive grid

Ensure cards & tables resize gracefully

Spacing: 16–24px standard, adjustable per component

C. Typography

Font: Sans-serif (e.g., Inter, Roboto)

Headings: H1-H6 hierarchy

Body text: 14–16px

Labels: 12–14px, readable on mobile

4️⃣ Component Library
Component	Use Case	Notes
Button	Form submission, actions	Primary, secondary, disabled states, hover effects
Form Inputs	Text, select, date, checkbox, radio	Validation messages, error highlighting
Table	Student lists, grades, payments	Sorting, filtering, responsive scroll
Card	Analytics, KPIs, summaries	Shadow, padding, consistent header & body
Modal	Confirmations, forms	Centered, scrollable if content > viewport
Tabs	Multi-section forms/reports	Term-wise, year-wise, analytics
Charts	Analytics dashboards	Line, radar, bar charts for CBC performance trends
Notifications	System alerts	Toasts, dismissible, color-coded (success, error, info)
Breadcrumbs	Navigation	Shows current module path, clickable
5️⃣ Module-Specific UI Guidelines
A. Academic

Teacher Dashboard:

List of assigned students/classes

Quick access to assessment entry forms

Analytics cards (average performance per learning area)

Student Reports:

Term-wise & yearly tabs

Charts per learning area & competencies

Export to PDF button

B. Administrative

Staff Management:

Table with search, filters, action buttons

School Profile:

Form layout, responsive edit sections

C. Finance

Fees & Payments:

Table for student fees

Status badges (Paid / Due / Overdue)

Action buttons for recording payments

D. Compliance

Disciplinary Records:

Table with incident summary

Modal for detailed record view

Parent Consents:

Form checkboxes, date pickers

Status indicator

E. Communication

Messages / Notifications:

Inbox-like layout

Read/unread indicators

Compose modal

6️⃣ Color Palette & Theme (AI-generated suggestions)

Primary: #1E3A8A (Deep Blue)

Secondary: #3B82F6 (Sky Blue)

Success: #10B981 (Green)

Warning: #F59E0B (Amber)

Error: #EF4444 (Red)

Background: #F9FAFB (Light Gray)

Card Background: #FFFFFF (White)

Text: #111827 (Dark Gray)

Notes: Claude should generate CSS/SCSS/Styled Components ready for Next.js.

7️⃣ Responsive Breakpoints

Mobile: <640px

Tablet: 640px–1024px

Desktop: 1024px+

Ensure: Tables scroll horizontally on small screens, cards stack vertically, forms adjust width.

8️⃣ AI Implementation Instructions

Generate Next.js components for all common UI elements.

Include responsive layouts and grid system.

Ensure theme, color palette, typography, and spacing are applied consistently.

Design dashboard & analytics UI for CBC reports with charts, trends, and export buttons.

Implement forms, tables, modals, notifications as reusable components.

Maintain mobile and tablet responsiveness.

Include concise Claude .md summary describing:

Components created

Responsiveness behavior

Dashboard layouts

Module-specific UI features

Ensure production-ready code, modular, and token-efficient.