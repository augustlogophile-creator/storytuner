# Ask Weaver effect crash fix

The Coach auto-scroll effect now uses a block-body effect and never returns the value of `scrollIntoView()` to React. This prevents React from treating a non-function browser return value as an effect cleanup during the next message render.

No Supabase SQL or Edge Function changes are required.
