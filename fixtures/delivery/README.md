# Delivery fixture

Isolated sample configuration; example/project and tracker.example.com are placeholders. No
credentials or login are stored here. Unit and worker tests simulate GitHub responses without
network calls. `npm run media:preview` offers these UI-only scenarios at `/panel?view=active`:
`&scenario=delivery`, `delivery-empty`, `delivery-unknown`, `delivery-stale`, `delivery-merged`.
Add `&theme=light` or `&theme=dark`. All account changes and requests in the preview are simulated.
