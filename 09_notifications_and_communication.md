1️⃣ Purpose

Enable real-time messaging between users

Implement system notifications for alerts, deadlines, and reminders

Support inbox/outbox functionality

Ensure role-based access and production-ready design

2️⃣ Tables
A. Messages
Table	Description	Key Columns
messages	User-to-user messages	message_id PK, sender_id FK, recipient_id FK, subject, body, read_status (Unread/Read), sent_at, created_at, updated_at

Notes:

Messages are private and RLS-enforced

Supports parent ↔ teacher, teacher ↔ teacher, admin ↔ all users

B. Notifications
Table	Description	Key Columns
notifications	System-generated notifications	notification_id PK, user_id FK, title, body, type (Info/Warning/Alert), read_status, created_at

Notes:

Includes deadline reminders, fee alerts, report generation alerts

Read/unread tracking

C. Broadcast Messages
Table	Description	Key Columns
broadcast_messages	Messages to multiple users (e.g., all parents, all teachers)	broadcast_id PK, title, body, target_roles (array), sent_at, created_by FK
3️⃣ API Endpoints
Messaging
Endpoint	Method	Purpose	Access
/api/messages	GET	List inbox messages	Teacher, Parent, Student, Admin
/api/messages/sent	GET	List sent messages	Same
/api/messages/:id	GET	View message	Recipient or sender only
/api/messages	POST	Send message	Teacher, Parent, Admin
/api/messages/:id	PUT	Mark read/unread	Recipient only
/api/messages/:id	DELETE	Delete message	Sender or Admin
Notifications
Endpoint	Method	Purpose	Access
/api/notifications	GET	Fetch notifications	User-specific
/api/notifications	POST	Create notification	Admin, Super Admin
/api/notifications/:id	PUT	Mark read/unread	User only
/api/notifications/:id	DELETE	Remove notification	Admin
Broadcast Messages
Endpoint	Method	Purpose	Access
/api/broadcast_messages	POST	Send to multiple users	Admin, Super Admin
/api/broadcast_messages	GET	List broadcast history	Admin
/api/broadcast_messages/:id	GET	View broadcast	Admin
/api/broadcast_messages/:id	DELETE	Delete broadcast	Admin
4️⃣ Role-Based Access
Role	Permissions
Super Admin	Full access to all messaging and notifications
School Admin	Broadcast to all roles, view all messages
Principal	View and send messages to teachers, parents, students
Deputy	View messages for assigned classes
Teacher	Message parents of assigned students, other teachers
Class Teacher	Message parents & students of own class
Parent	View and message own child’s teachers
Student	Message teachers, view messages, read notifications
ICT Admin	Monitor system notifications only
5️⃣ Dashboard & UX

Inbox / Sent / Broadcast tabs

Unread indicators (badge notifications)

Real-time update support (optional PWA/WebSocket)

Filters: by sender, date, type, class

Responsive design: stacked cards on mobile, table view on desktop

Message compose modal: supports subject + rich text body

6️⃣ AI Implementation Instructions

Implement tables (messages, notifications, broadcast_messages) with foreign keys & constraints

Apply RLS policies to ensure privacy per role

Implement CRUD API endpoints for messaging and notifications

Support broadcast messaging to multiple roles

Create dashboard widgets for unread counts and message summaries

Ensure role-specific filtering on inbox, sent, and broadcast messages

Prepare concise Claude .md summary describing:

Tables and relationships

API endpoints

Dashboard layout & features

Role-based access rules

Maintain modular, production-ready, token-efficient design
