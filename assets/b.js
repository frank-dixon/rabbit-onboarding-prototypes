/*
 * Prototype B: one page with progressive disclosure.
 *
 * Each step is a native <details> section, so it opens and closes with
 * the keyboard and works with screen readers without extra script. A
 * section unlocks only after the one before it passes its checks, and
 * locked sections cannot be opened. On wide screens a live summary sits
 * beside the sections; on a phone it moves above them.
 */
(function () {
  "use strict";
  const P = window.Proto;
  const FLOW = "b";
  const app = document.getElementById("app");
  const draft = P.getDraft(FLOW);
  const LAST = P.STEPS.length - 1;
  draft.unlocked = Math.min(Math.max(Number(draft.unlocked) || 0, 0), LAST);
  let open = draft.unlocked;

  const PRIMARY = "inline-flex min-h-11 items-center justify-center rounded bg-neutral-900 px-5 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2";

  function stepDone(index) {
    return index < draft.unlocked;
  }

  function sectionNote(step, index) {
    if (index > draft.unlocked) {
      return "Locked. Finish " + P.STEPS[index - 1].title.toLowerCase() + " first.";
    }
    if (!stepDone(index)) {
      return index === LAST ? "Ready to review" : "To do";
    }
    if (step.id === "basics") {
      return "Done · " + draft.name;
    }
    if (step.id === "breed") {
      return "Done · " + P.breedLine(draft);
    }
    if (step.id === "relatives") {
      return "Done · " + draft.relatives.length + " added";
    }
    if (step.id === "pedigree") {
      return "Done · " + P.PEDIGREE.filter(function (p) { return P.slotFilled(draft.pedigree[p]); }).length + " of 14 places";
    }
    return "Done";
  }

  function section(step, index) {
    const locked = index > draft.unlocked;
    const body = locked
      ? ""
      : '<div class="space-y-5 border-t border-neutral-200 p-4 sm:p-5" data-section-body>' +
        P.errorSummary() +
        (step.id === "review"
          ? '<div data-review>' + P.renderReview(draft) + "</div>" +
            '<button type="button" class="' + PRIMARY + '" data-save>Save rabbit</button>'
          : step.keys.map(function (key) { return P.renderField(key, draft); }).join("") +
            '<button type="button" class="' + PRIMARY + '" data-continue="' + index + '">Continue to ' + P.STEPS[index + 1].title.toLowerCase() + "</button>") +
        "</div>";
    return '<details class="rounded-lg border bg-white ' + (locked ? "border-neutral-200 opacity-70" : "border-neutral-300") + '" id="section-' + step.id + '" data-index="' + index + '"' +
      (index === open && !locked ? " open" : "") + ">" +
      '<summary class="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900' + (locked ? " cursor-not-allowed" : "") + '"' +
      (locked ? ' aria-disabled="true"' : "") + ">" +
      '<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ' +
      (stepDone(index) ? "bg-neutral-900 text-white" : "border border-neutral-400") + '" aria-hidden="true">' + (stepDone(index) ? "✓" : index + 1) + "</span>" +
      '<span class="min-w-0 flex-1"><span class="block font-semibold">' + (index + 1) + ". " + step.title + "</span>" +
      '<span class="block truncate text-sm text-neutral-600">' + P.esc(sectionNote(step, index)) + "</span></span>" +
      (locked ? '<span class="text-xs font-medium text-neutral-500">Locked</span>' : '<span class="text-neutral-500" aria-hidden="true">▾</span>') +
      "</summary>" + body + "</details>";
  }

  function summary() {
    const data = P.load();
    const filled = P.PEDIGREE.filter(function (p) { return P.slotFilled(draft.pedigree[p]); }).length;
    const rows = [
      ["Name", draft.name || "—"],
      ["Sex", draft.sex ? (draft.sex === "doe" ? "Doe" : "Buck") : "—"],
      ["Born", draft.birthDate || "—"],
      ["Breed", draft.breedType ? P.breedLine(draft) || "—" : "—"],
      ["Relatives", draft.relatives.filter(P.slotFilled).map(function (row) { return P.refName(data, row); }).join(", ") || "—"],
      ["Pedigree", filled + " of 14 places"],
    ];
    return '<h2 class="font-semibold">Summary</h2><dl class="mt-2 space-y-1 text-sm">' + rows.map(function (row) {
      return '<div class="flex gap-2"><dt class="w-20 shrink-0 text-neutral-600">' + row[0] + '</dt><dd class="min-w-0 break-words">' + P.esc(row[1]) + "</dd></div>";
    }).join("") + "</dl>" +
      '<p class="mt-3 text-xs text-neutral-600">Saved on this device as you type.</p>';
  }

  function render(focusSelector) {
    if (draft.unlocked >= 3) {
      P.prefillPedigree(draft);
    }
    app.innerHTML = '<div class="grid gap-6 lg:grid-cols-3">' +
      '<aside class="rounded-lg border border-neutral-300 bg-white p-4 lg:sticky lg:top-4 lg:order-2 lg:self-start" aria-label="Summary" data-summary>' + summary() + "</aside>" +
      '<div class="space-y-3 lg:col-span-2" data-sections>' + P.STEPS.map(section).join("") + "</div></div>" +
      '<p class="mt-4 text-sm"><button type="button" class="underline" data-restart>Start over</button></p>';
    P.refreshLive(app, draft);
    if (focusSelector) {
      const target = app.querySelector(focusSelector);
      if (target) {
        target.focus();
      }
    }
  }

  app.addEventListener("click", function (event) {
    const summaryEl = event.target.closest("summary");
    if (summaryEl && summaryEl.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    const cont = event.target.closest("[data-continue]");
    if (cont) {
      const index = Number(cont.getAttribute("data-continue"));
      const sectionEl = cont.closest("details");
      if (!P.showErrors(sectionEl, P.validate(draft, P.STEPS[index].keys))) {
        return;
      }
      draft.unlocked = Math.max(draft.unlocked, index + 1);
      open = index + 1;
      P.saveDraft(FLOW, draft);
      render("#section-" + P.STEPS[index + 1].id + " > summary");
      return;
    }
    if (event.target.closest("[data-save]")) {
      for (let index = 0; index < LAST; index += 1) {
        const errors = P.validate(draft, P.STEPS[index].keys);
        if (Object.keys(errors).length) {
          open = index;
          render();
          P.showErrors(document.getElementById("section-" + P.STEPS[index].id), errors);
          return;
        }
      }
      const rabbit = P.finish(FLOW, draft);
      app.innerHTML = '<div class="mx-auto max-w-xl rounded-lg border border-green-700 bg-white p-6" role="status">' +
        '<h2 class="text-xl font-semibold focus:outline-none" tabindex="-1" id="done-heading">' + P.esc(rabbit.name) + " was added.</h2>" +
        '<p class="mt-2 text-neutral-700">' + P.esc(rabbit.breedLine) + '. Saved on this device.</p>' +
        '<div class="mt-4 flex flex-wrap gap-3"><a class="' + PRIMARY + '" href="../">See the herd</a>' +
        '<a class="inline-flex min-h-11 items-center rounded border border-neutral-500 bg-white px-5 py-2 font-medium" href="./">Add another</a></div></div>';
      document.getElementById("done-heading").focus();
      return;
    }
    if (event.target.closest("[data-restart]") && window.confirm("Clear this draft and start over?")) {
      P.clearDraft(FLOW);
      const fresh = P.getDraft(FLOW);
      Object.keys(draft).forEach(function (key) { delete draft[key]; });
      Object.assign(draft, fresh);
      open = 0;
      render();
    }
  });

  /* Keep the open section in memory so re-renders do not jump around,
   * and refresh the review text whenever that section opens. */
  app.addEventListener("toggle", function (event) {
    const details = event.target;
    if (!details.matches || !details.matches("details[data-index]")) {
      return;
    }
    if (details.open) {
      open = Number(details.getAttribute("data-index"));
      const review = details.querySelector("[data-review]");
      if (review) {
        review.innerHTML = P.renderReview(draft);
      }
    }
  }, true);

  P.bind(app, FLOW, draft, {
    onStructure: function (focusId) {
      render(focusId ? "#" + focusId : null);
    },
    onChange: function () {
      const aside = app.querySelector("[data-summary]");
      if (aside) {
        aside.innerHTML = summary();
      }
    },
  });
  render();
})();
