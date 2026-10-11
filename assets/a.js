/*
 * Prototype A: a classic stepper wizard.
 *
 * One step per screen with Back and Next and a progress bar. Next checks
 * only the current step. The step number is saved with the draft, so a
 * refresh lands on the same step. Moving to a step puts focus on its
 * heading so screen reader and keyboard users know where they are.
 */
(function () {
  "use strict";
  const P = window.Proto;
  const FLOW = "a";
  const app = document.getElementById("app");
  const draft = P.getDraft(FLOW);
  draft.step = Math.min(Math.max(Number(draft.step) || 0, 0), P.STEPS.length - 1);

  const PRIMARY = "inline-flex min-h-11 items-center justify-center rounded bg-neutral-900 px-5 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2";
  const SECONDARY = "inline-flex min-h-11 items-center justify-center rounded border border-neutral-500 bg-white px-5 py-2 font-medium text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900";

  function progress() {
    const total = P.STEPS.length;
    const current = draft.step + 1;
    const items = P.STEPS.map(function (step, index) {
      const state = index < draft.step ? "done" : index === draft.step ? "current" : "todo";
      return '<li class="flex-1"' + (state === "current" ? ' aria-current="step"' : "") + ">" +
        '<span class="block h-2 rounded-full ' + (state === "todo" ? "bg-neutral-300" : "bg-neutral-900") + '"></span>' +
        '<span class="mt-1 hidden text-xs sm:block ' + (state === "current" ? "font-semibold" : "text-neutral-600") + '">' + step.title + "</span>" +
        "</li>";
    }).join("");
    return '<nav aria-label="Progress">' +
      '<p class="text-sm font-medium text-neutral-700">Step ' + current + " of " + total + ": " + P.STEPS[draft.step].title + "</p>" +
      '<ol class="mt-2 flex gap-1">' + items + "</ol></nav>";
  }

  function render(focusId) {
    const step = P.STEPS[draft.step];
    if (step.id === "pedigree") {
      P.prefillPedigree(draft);
      P.saveDraft(FLOW, draft);
    }
    const body = step.id === "review"
      ? '<p class="text-neutral-700">Check the details, then save. Use Back to change anything.</p>' + P.renderReview(draft)
      : step.keys.map(function (key) { return P.renderField(key, draft); }).join("");
    const last = draft.step === P.STEPS.length - 1;
    app.innerHTML = progress() +
      '<form class="mt-6 space-y-5 rounded-lg border border-neutral-300 bg-white p-4 sm:p-6" novalidate>' +
      '<h2 class="text-xl font-semibold focus:outline-none" tabindex="-1" id="step-heading">' + step.title + "</h2>" +
      P.errorSummary() + body +
      '<div class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">' +
      (draft.step > 0 ? '<button type="button" class="' + SECONDARY + '" data-nav="back">Back</button>' : "<span></span>") +
      '<button type="submit" class="' + PRIMARY + '">' + (last ? "Save rabbit" : "Next: " + P.STEPS[draft.step + 1].title) + "</button>" +
      "</div></form>" +
      '<p class="mt-4 text-sm"><button type="button" class="underline" data-nav="restart">Start over</button> · Progress saves on this device as you type.</p>';
    P.refreshLive(app, draft);
    const target = focusId ? document.getElementById(focusId) : null;
    if (target) {
      target.focus();
    }
  }

  function go(step) {
    draft.step = step;
    P.saveDraft(FLOW, draft);
    render("step-heading");
    window.scrollTo(0, 0);
  }

  app.addEventListener("submit", function (event) {
    event.preventDefault();
    const step = P.STEPS[draft.step];
    if (step.id === "review") {
      const all = P.STEPS.reduce(function (keys, s) { return keys.concat(s.keys); }, []);
      const errors = P.validate(draft, all);
      if (Object.keys(errors).length) {
        const firstBad = P.STEPS.findIndex(function (s) {
          return Object.keys(P.validate(draft, s.keys)).length > 0;
        });
        go(firstBad);
        P.showErrors(app, P.validate(draft, P.STEPS[firstBad].keys));
        return;
      }
      const rabbit = P.finish(FLOW, draft);
      app.innerHTML = '<div class="rounded-lg border border-green-700 bg-white p-6" role="status">' +
        '<h2 class="text-xl font-semibold focus:outline-none" tabindex="-1" id="done-heading">' + P.esc(rabbit.name) + " was added.</h2>" +
        '<p class="mt-2 text-neutral-700">' + P.esc(rabbit.breedLine) + ". Saved on this device.</p>" +
        '<div class="mt-4 flex flex-wrap gap-3"><a class="' + PRIMARY + '" href="../">See the herd</a>' +
        '<a class="' + SECONDARY + '" href="./">Add another</a></div></div>';
      document.getElementById("done-heading").focus();
      return;
    }
    if (P.showErrors(app, P.validate(draft, step.keys))) {
      go(draft.step + 1);
    }
  });

  app.addEventListener("click", function (event) {
    const nav = event.target.closest("[data-nav]");
    if (!nav) {
      return;
    }
    if (nav.getAttribute("data-nav") === "back") {
      go(draft.step - 1);
    } else if (nav.getAttribute("data-nav") === "restart" && window.confirm("Clear this draft and start over?")) {
      P.clearDraft(FLOW);
      // Reset in place: the bound listeners keep a reference to this object.
      const fresh = P.getDraft(FLOW);
      Object.keys(draft).forEach(function (key) { delete draft[key]; });
      Object.assign(draft, fresh);
      go(0);
    }
  });

  const hooks = { onStructure: render };
  P.bind(app, FLOW, draft, hooks);
  render();
})();
