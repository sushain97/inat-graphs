```bash
pnpm dev                      # run locally at http://localhost:8501
pnpm build                    # production build
pnpm start                    # run a production build

pnpm lint                     # ESLint
pnpm format                   # Prettier
pnpm typecheck                # TSC

pnpm update:inat-spec         # re-fetch iNaturalist's OpenAPI spec into data/inat-swagger.json
pnpm update:wingspan-data     # re-fetch the Wingspan card data into data/wingspan-*.json
pnpm check-ebird <path.csv>   # diff an eBird export against iNaturalist observations
```
