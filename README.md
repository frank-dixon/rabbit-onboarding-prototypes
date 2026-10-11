# Rabbit onboarding prototypes

Throwaway static prototypes of the Rabbit Herd add-a-rabbit flow, so the
three layouts can be tried side by side on a phone, a tablet, and a
desktop. This is a demo. It saves only in the browser that opens it, with
`localStorage`, and the herd is fake. There is no server, no account, and
no real herd data.

- **Prototype A** (`a/`): a stepper wizard, one step per screen with Back,
  Next, and a progress bar.
- **Prototype B** (`b/`): one page of accordion sections that unlock in
  order, with a live summary beside them on wide screens.
- **Prototype C** (`c/`): mobile first, one question per card, with large
  tap targets and a bottom bar.

All three share the same steps, data, and checks (`assets/shared.js`):
basics with a native date picker, a purebred breed select or a crossbred
mix whose percentages must total 100, relatives from the herd or outside
rabbits, a three-generation pedigree builder, and a review.

The breed list (`assets/breeds.js`) is the 53 ARBA recognized breeds
(https://arba.net/recognized-breeds/) plus 33 breeds recognized by the
British Rabbit Council but not by ARBA
(https://www.thebritishrabbitcouncil.org/rabbit-breeds.php).

The site is an installable PWA with a service worker that caches every
file, so it works offline after the first visit. All paths are relative,
so it runs under a GitHub Pages subpath.

## Develop

```sh
npm install
npm run watch   # rebuilds assets/app.css while you edit
npm run build   # one minified build; commit assets/app.css
python3 -m http.server 8000   # then open http://localhost:8000/
```

The compiled stylesheet is committed so GitHub Pages can serve the repo
as is, with no build step.
