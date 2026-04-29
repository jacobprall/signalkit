Show, Don't Tell
Build something real, an app that makes developers think, "I want to deploy this on Render."
Brief
Create a multiservice AI-powered application. Your code should demonstrate real-world
deployment patterns while serving as a learning resource for other developers.
Requirements
The App
- Build an AI-powered application (chatbot, agent, content generator, recommendation
system, etc.)
- Something you'd actually be proud to share
The Stack
- At least one web service
- At least one managed datastore (Postgres / Key Value)
- At least one additional service of any type
- Use Python or TypeScript
- Bonus: Blueprint, Background workers, Cron Jobs, or other Render services if they fit
your concept
The Story
Your code and README should:
- Explain why you made key decisions, not just what you built
- Help someone understand how to deploy their own multiservice app
- Make the deployment journey feel rewarding
Deliverables
- Live demo URL(s)
- GitHub repo link with a clear README and Blueprint configuration
We're Evaluating
- Does it work well?
- Does it demonstrate best practices?
- Can developers learn from it?
- Does it make Render look appealing?


Prior to the interview, we kindly ask that you share the project that you built. This will give the panel helpful context about your work and provide a starting point for discussion during the interview. During the session, be prepared to discuss:

-   How you approached building the content (topic selection, format, structure, and audience).
-   Your goals for the piece and how you measured or would measure its success.
-   How you would teach the topic to a group of developers hearing about it for the first time.
-   What you would change or do differently if you were recreating it today.

## Render context
Segmentation
- Engineers deploying internal apps within enterprises
- Small startups scaling up AI-native SaaS products
- 20-60 person engineering teams

## Requirements
- Must be multi-service
- Must be AI powered
- Use TypeScript
- Use blueprint, background workers, and cron job

## Ideas
- GTM Engineering use case? Break down how I built, then talk through distribution, promotion, etc. Lots of rich opps for blog around it that's not strictly infrastructure related
- Sophisticated multi-service app that demonstrates scalable microservices architecture, maybe with a message bus etc.
- Cool ways to leverage key value and postgres?
- Leverage APIs to identify companies hiring their first devrel?


One abstraction rules the system. Everything is a job. The queue is the central nervous system. Workers don't care what they're processing -- they pull, dispatch, done.

Signals are the universal interface between stages. Collectors don't know about triggers. Actions don't know about collectors. They all speak "signals." You can rewire the system by changing trigger conditions, not code.

Adding capabilities is additive, never invasive. New data source? Write a collector, register it. New AI feature? Write an action, register it. New output channel? Write a delivery, register it. Nothing else changes.

The pipeline is self-documenting. Every job spawns the next jobs explicitly. You can trace any action output back through the chain: delivery ← action_run ← trigger ← signals ← collection_run. Full provenance.

Horizontal scaling is free. Add more worker instances, they all pull from the same Redis queue. Rate-limit API-heavy collectors with BullMQ's built-in rate limiter. Priority queues ensure AI actions (expensive, user-facing) run before bulk collection jobs.



