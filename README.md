# plan

"The plan was to drink until the pain's over. But what's worse? The pain or the hangover" - Kanye

# how to run

get off the couch and touch grass

# how to run this project

in browser/

create a .env and add your OPENAI_API_KEY

two terminals:

`npm i -g bun`

in front/

```
bun dev
```

in back/

```
bun dev
```

go to `http://localhost:5173`

# design

- front end in vite and tailwind. Click the book a demo button and it will trigger the agent by creating a asynchronous request on the back-end. KISS. Then poll the back end every couple seconds to see if the job needs anything new from the user. If the job requires the user to fill out a profile, show those profile steps.
- back end written in bun / elysia usage. Data stored in SQLite. Each user has their own sqlite DB. A user cannot be created through the UI for the purpose of this demo. We can use a secure id from the front end to "authorize" the user.
- browser - CLI python tool that has two different options. 1st, scan the webpage to find the required fields. The back end determines if the profile table has those fields already. If they do not exist, then a request returns to the front end to inform the user to fill out the required fields in a new profile. The second option would be to fill out and book an appointment given the fields in the "profile"
