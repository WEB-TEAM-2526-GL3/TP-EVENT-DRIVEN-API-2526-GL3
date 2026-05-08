# Gestionnaire de CVs - EVENT DRIVEN API

This repository is based on our `TP-REST-2526-GL3` repository.


**Prerequisites**

- Node.js installed
- Docker Desktop installed and running


**Setup**

- `npm install`

- `docker compose up -d`

- create a `.env` file following the `.env.example` file

- `npm run seed` # this is for seeding

- `npm run start:dev`


**Development**

Before staging and committing, test your solution

- `npm run lint`
- `npm run format`
- Make sure everything is fine [maybe by running the application]
- `git add ...`
- `git commit -m "..."`






Amr wake up:
this is the right logic for web socket

User
- id
- name
- email

Conversation
- id
- type        // "direct" or "group"
- name        // group name, can be null for direct chat

ConversationMember
- id
- conversationId
- userId
- role        // "member", "admin"

Message
- id
- conversationId
- senderId
- text
- createdAt