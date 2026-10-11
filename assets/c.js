/*
 * Prototype C: mobile first, one question per card.
 *
 * The basics, breed, and relatives are split into nine short questions
 * that read like a conversation and use the rabbit's name once it is
 * known. Answers are large tiles and inputs, and Back and Next live in a
 * bar fixed to the bottom of the screen, where thumbs reach. Enter on a
 * text answer moves on. The relatives question is optional and offers Skip
 * until something is filled in. The current card is saved with the draft,
 * so a refresh returns to it.
 */
(function () {
  "use strict";
  const P = window.Proto;
  const FLOW = "c";
  const app = document.getElementById("app");
  const draft = P.getDraft(FLOW);

  function who() {
    return draft.name.trim() || "this rabbit";
  }

  const QUESTIONS = [
    { key: "name", ask: function () { return "What do you call this rabbit?"; }, hint: "A name or an ear tag is fine." },
    { key: "sex", ask: function () { return "Is " + who() + " a doe or a buck?"; } },
    { key: "birthDate", ask: function () { return "When was " + who() + " born?"; } },
    { key: "color", ask: function () { return "What color is " + who() + "?"; } },
    { key: "status", ask: function () { return "What is " + who() + " doing in the herd?"; } },
    { key: "breedType", ask: function () { return "Is " + who() + " purebred or a cross?"; } },
    {
      key: "breed",
      ask: function () {
        return draft.breedType === "crossbred" ? "Which breeds are in " + who() + "'s mix?" : "Which breed is " + who() + "?";
      },
    },
    { key: "relatives", optional: true, ask: function () { return "Do you know any of " + who() + "'s relatives?"; } },
    { key: "review", ask: function () { return "Does this look right?"; } },
  ];
  draft.step = Math.min(Math.max(Number(draft.step) || 0, 0), QUESTIONS.length - 1);

  const NEXT = "inline-flex min-h-14 flex-1 items-center justify-center rounded-lg bg-neutral-900 px-5 text-lg font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2";
  const BACK = "inline-flex min-h-14 items-center justify-center rounded-lg border border-neutral-500 bg-white px-5 text-lg font-medium text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900";

  function filled(question) {
    if (question.key === "relatives") {
      return draft.relatives.length > 0;
    }
    return true;
  }

  function fieldsFor(question) {
    if (question.key === "review") {
      return P.renderReview(draft, { pedigree: false });
    }
    return P.renderField(question.key, draft, { large: true, quiet: true });
  }

  function nextLabel(question) {
    if (question.key === "review") {
      return "Save " + who();
    }
    if (question.optional && !filled(question)) {
      return "Skip";
    }
    return "Next";
  }

  function render(focusId) {
    const question = QUESTIONS[draft.step];
    const count = QUESTIONS.length;
    const percent = Math.round(((draft.step + 1) / count) * 100);
    app.innerHTML =
      '<div class="flex items-center gap-3" aria-hidden="true"><div class="h-1.5 flex-1 rounded-full bg-neutral-300"><div class="h-1.5 rounded-full bg-neutral-900" style="width:' + percent + '%"></div></div>' +
      '<span class="text-xs font-medium text-neutral-600">' + (draft.step + 1) + "/" + count + "</span></div>" +
      '<form class="mt-4" novalidate>' +
      '<section class="space-y-5 rounded-2xl border border-neutral-300 bg-white p-5 shadow-sm">' +
      '<p class="sr-only">Question ' + (draft.step + 1) + " of " + count + "</p>" +
      '<h1 class="text-2xl font-semibold leading-snug tracking-tight focus:outline-none" tabindex="-1" id="question">' + P.esc(question.ask()) + "</h1>" +
      (question.hint ? '<p class="-mt-3 text-neutral-600">' + question.hint + "</p>" : "") +
      P.errorSummary() + fieldsFor(question) +
      "</section>" +
      '<div class="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-300 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">' +
      '<div class="mx-auto flex max-w-md gap-3">' +
      (draft.step > 0 ? '<button type="button" class="' + BACK + '" data-nav="back">Back</button>' : "") +
      '<button type="submit" class="' + NEXT + '" data-next>' + P.esc(nextLabel(question)) + "</button>" +
      "</div></div></form>" +
      '<p class="mt-4 text-sm text-neutral-600"><button type="button" class="underline" data-nav="restart">Start over</button> · Saved on this device.</p>';
    P.refreshLive(app, draft);
    const target = focusId ? document.getElementById(focusId) : null;
    if (target) {
      target.focus();
    }
  }

  function go(step) {
    draft.step = step;
    P.saveDraft(FLOW, draft);
    render("question");
    window.scrollTo(0, 0);
  }

  app.addEventListener("submit", function (event) {
    event.preventDefault();
    const question = QUESTIONS[draft.step];
    if (question.key === "review") {
      for (let index = 0; index < QUESTIONS.length - 1; index += 1) {
        const errors = P.validate(draft, [QUESTIONS[index].key]);
        if (Object.keys(errors).length) {
          go(index);
          P.showErrors(app, errors);
          return;
        }
      }
      const rabbit = P.finish(FLOW, draft);
      app.innerHTML = '<section class="mt-4 rounded-2xl border border-green-700 bg-white p-6 text-center shadow-sm" role="status">' +
        '<p class="text-5xl" aria-hidden="true">🐇</p>' +
        '<h1 class="mt-2 text-2xl font-semibold focus:outline-none" tabindex="-1" id="done-heading">' + P.esc(rabbit.name) + " was added.</h1>" +
        '<p class="mt-2 text-neutral-700">' + P.esc(rabbit.breedLine) + ". Saved on this device.</p>" +
        '<div class="mt-6 flex flex-col gap-3"><a class="' + NEXT + '" href="../">See the herd</a><a class="' + BACK + '" href="./">Add another</a></div></section>';
      document.getElementById("done-heading").focus();
      return;
    }
    if (P.showErrors(app, P.validate(draft, [question.key]))) {
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
      const fresh = P.getDraft(FLOW);
      Object.keys(draft).forEach(function (key) { delete draft[key]; });
      Object.assign(draft, fresh);
      go(0);
    }
  });

  P.bind(app, FLOW, draft, {
    onStructure: render,
    onChange: function () {
      const button = app.querySelector("[data-next]");
      if (button) {
        button.textContent = nextLabel(QUESTIONS[draft.step]);
      }
    },
  });
  render();
})();
