# @adventures/entity-ui

The schema-driven parts of an Adventures screen. Nothing here names an entity: the server sends a schema and the parts draw it.

- **`adv-entity-grid`**: a paged, sortable grid of any collection (columns from the schema, links from the server).
- **`adv-entity-form`**: a form for one entry (read-only fields, choices as pick lists, pointer fields, Markdown fields, the server's field messages).
- **`adv-relation-grid`**: the grid of a relation under a form (for example a person's role assignments), with a labelled Add step.
- **`adv-markdown-content`**: authored Markdown rendered safely (sanitised; Mermaid diagrams supported).
- **`LabelPipe`**: the shared field labels.

Depends on `@adventures/core` (the contract models and `EntityApiService`) and on Angular Material and `ngx-markdown` as peers. Build order: `ng build core`, then `ng build entity-ui`. Tests: `ng test entity-ui`.
